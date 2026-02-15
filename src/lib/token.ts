export function estimateTokens(input: string): number {
  if (!input.trim()) {
    return 0;
  }
  return Math.max(1, Math.ceil(input.length / 4));
}

export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
}
