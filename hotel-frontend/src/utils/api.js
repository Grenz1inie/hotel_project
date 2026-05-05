export async function sendMessageToBot(message) {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error("网络错误");
    const data = await response.json();
    return data.reply;
}