// Build instructions + input for Hugging Face Router Responses API (chat-style).
function messagesToInstructionsAndInput(messages) {
  if (!Array.isArray(messages)) {
    return { instructions: "", input: String(messages || "") };
  }
  let instructions = "";
  const userParts = [];
  for (const m of messages) {
    if (!m || typeof m.content !== "string") continue;
    if (m.role === "system" && !instructions) {
      instructions = m.content;
    } else {
      userParts.push(m.content);
    }
  }
  return {
    instructions,
    input: userParts.join("\n\n"),
  };
}

// Extract text from Responses API: output_text or output[].content[].text.
function getOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (Array.isArray(data?.output)) {
    const parts = [];
    for (const item of data.output) {
      const c = item?.content;
      if (Array.isArray(c)) {
        for (const part of c) {
          if (typeof part?.text === "string") parts.push(part.text);
          else if (typeof part === "string") parts.push(part);
        }
      } else if (typeof c === "string") parts.push(c);
    }
    if (parts.length) return parts.join("\n").trim();
  }
  return null;
}

async function createRoadmapCompletion(messages) {
  const url = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  const { instructions, input } = messagesToInstructionsAndInput(messages);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      max_output_tokens: 1200,
    }),
  });

  const data = await res.json().catch(() => null);

  if (process.env.NODE_ENV !== "test") {
    console.log("[hf_responses_raw]", JSON.stringify(data, null, 2));
  }

  // Router can return 200 with status "failed" and error message (e.g. "not a chat model").
  if (data?.status === "failed" && data?.error?.message) {
    const err = new Error(`AI API: ${data.error.message}`);
    err.statusCode = 502;
    err.publicMessage =
      "The selected model is not supported. Use a chat model from Hugging Face Inference Providers (see README).";
    throw err;
  }

  if (!res.ok) {
    const text = typeof data === "object" ? JSON.stringify(data) : (data || "");
    const err = new Error(`AI API error: ${res.status} ${res.statusText} ${text}`.trim());
    err.statusCode = res.status === 429 ? 502 : 502;
    err.publicMessage =
      res.status === 429
        ? "AI service is rate-limited. Please wait a bit and try again."
        : "AI service is unavailable. Please try again.";
    throw err;
  }

  const content = getOutputText(data);
  if (!content) {
    const err = new Error("AI API returned no usable text output.");
    err.statusCode = 502;
    err.publicMessage = "AI service returned empty output. Please try again.";
    throw err;
  }
  return content;
}

module.exports = { createRoadmapCompletion };

