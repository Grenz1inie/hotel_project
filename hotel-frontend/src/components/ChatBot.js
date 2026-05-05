import React, { useState } from "react";
import { sendMessageToBot } from "../utils/api";

export default function ChatBot() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!input) return;
        const userMessage = { sender: "user", text: input };
        setMessages((msgs) => [...msgs, userMessage]);
        setInput("");
        setLoading(true);
        try {
            const res = await sendMessageToBot(input);
            setMessages((msgs) => [...msgs, { sender: "bot", text: res }]);
        } catch (e) {
            setMessages((msgs) => [
                ...msgs,
                { sender: "bot", text: "客服机器人暂时无法响应，请稍后再试。" }
            ]);
        }
        setLoading(false);
    };

    return (
        <div className="chatbot-container">
            <div className="chat-history">
                {messages.map((msg, i) => (
                    <div key={i} className={`msg msg-${msg.sender}`}>
                        {msg.text}
                    </div>
                ))}
            </div>
            <div className="chat-input-bar">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="请输入您的问题…"
                    disabled={loading}
                />
                <button onClick={sendMessage} disabled={loading || !input}>
                    发送
                </button>
            </div>
        </div>
    );
}
