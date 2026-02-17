
"use client";

import { useState, useRef, useEffect } from "react";
import { ucp } from "@/lib/ucp";
import { model, toolHandlers } from "@/lib/agent";
import { Send, User, Bot, Loader2, ShoppingCart, Globe, UserCircle } from "lucide-react";
import { ChatSession } from "@google/generative-ai";

interface Message {
  role: "user" | "model" | "system";
  content: string;
  type?: "text" | "product" | "checkout";
  data?: any;
}

type OnboardingStep = "name" | "merchant" | "complete";

export function Chat() {
  const [step, setStep] = useState<OnboardingStep>("name");
  const [userName, setUserName] = useState("");
  const [merchantUrl, setMerchantUrl] = useState("");
  const [merchantName, setMerchantName] = useState("Merchant");
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", content: "Hello! Welcome to the UCP Client. Before we begin, could you please tell me your name?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (step === "complete" && !chatSession && key) {
      const session = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });
      setChatSession(session);
    }
  }, [step, chatSession]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleOnboarding = async (value: string) => {
    if (step === "name") {
      setUserName(value);
      setMessages(prev => [
        ...prev, 
        { role: "user", content: value },
        { role: "model", content: `Nice to meet you, ${value}! Now, please provide the UCP profile URL of the merchant you'd like to connect to (e.g., https://wedding-merchant-us3xiidh7q-uc.a.run.app).` }
      ]);
      setStep("merchant");
      setInput("");
    } else if (step === "merchant") {
      setLoading(true);
      try {
        let url = value.trim();
        if (!url.startsWith("http")) {
          if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
            url = `http://${url}`;
          } else {
            url = `https://${url}`;
          }
        }
        ucp.setBaseUrl(url);
        setMerchantUrl(url);
        
        const info = await ucp.getMerchantInfo();
        const name = info?.merchant?.name || "the Merchant";
        setMerchantName(name);
        
        setMessages(prev => [
          ...prev,
          { role: "user", content: value },
          { 
            role: "model", 
            content: `Connected to ${name}! ${info?.merchant?.description || ''} How can I help you today, ${userName}?` 
          }
        ]);
        setStep("complete");
      } catch (e) {
        setMessages(prev => [...prev, { role: "model", content: "I couldn't connect to that merchant. Please make sure the URL is correct and supports UCP." }]);
      } finally {
        setLoading(false);
        setInput("");
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (step !== "complete") {
      handleOnboarding(input);
      return;
    }

    if (!chatSession) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      let result = await chatSession.sendMessage(userMessage);
      let response = result.response;
      let calls = response.functionCalls();

      while (calls && calls.length > 0) {
        const toolResponses: any[] = [];
        
        for (const call of calls) {
          const handler = toolHandlers[call.name];
          if (handler) {
            try {
              const data = await handler(call.args);
              toolResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { content: data }
                }
              });
              
              if (call.name === "list_products") {
                setMessages(prev => [...prev, { role: "system", content: "Fetched products", type: "product", data }]);
              } else if (call.name === "create_checkout") {
                setMessages(prev => [...prev, { role: "system", content: "Checkout session created", type: "checkout", data }]);
              }
            } catch (error: any) {
              toolResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: error.message }
                }
              });
            }
          }
        }

        result = await chatSession.sendMessage(toolResponses);
        response = result.response;
        calls = response.functionCalls();
      }

      const modelResponse = response.text();
      setMessages(prev => [...prev, { role: "model", content: modelResponse }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "system", content: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center justify-between font-bold text-slate-800">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-blue-600" />
          {step === "complete" ? `Client - ${merchantName}` : "UCP Client Onboarding"}
        </div>
        {userName && (
          <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            <UserCircle size={14} />
            {userName}
          </div>
        )}
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : m.role === 'system' 
                  ? 'bg-slate-100 text-slate-600 text-sm italic border' 
                  : 'bg-slate-100 text-slate-800'
            }`}>
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs font-bold uppercase">
                {m.role === 'user' ? <User size={12} /> : m.role === 'model' ? <Bot size={12} /> : null}
                {m.role}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
              
              {m.type === "product" && m.data && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {(Array.isArray(m.data) ? m.data : m.data.items || [])?.map((item: any) => (
                    <button 
                      key={item.id} 
                      onClick={() => {
                        if (step === "complete" && !loading) {
                          setInput(`I want to buy ${item.title || item.name} (ID: ${item.id})`);
                          // We use a small timeout to ensure the state update is reflected before we would normally trigger handleSend, 
                          // but since handleSend is tied to the form submit, we'll just set the input for the user to confirm or 
                          // we can trigger the send automatically. Let's trigger it automatically for better UX.
                          setTimeout(() => {
                            const submitBtn = document.getElementById('send-button');
                            submitBtn?.click();
                          }, 100);
                        }
                      }}
                      className="bg-white p-2 rounded border flex justify-between items-center text-slate-800 text-sm shadow-sm hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all text-left group"
                    >
                      <div className="flex-1 mr-2">
                        <div className="font-bold group-hover:text-blue-600 transition-colors">{item.title || item.name}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{item.description}</div>
                        <div className="font-mono text-blue-600">${((item.price || 0) / 100).toFixed(2)}</div>
                      </div>
                      <div className="text-[10px] bg-slate-100 p-1 rounded font-mono shrink-0 group-hover:bg-blue-50">Buy Now</div>
                    </button>
                  ))}
                </div>
              )}

              {m.type === "checkout" && m.data && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <ShoppingCart size={14} />
                    {m.data.status === 'completed' ? 'Order Completed!' : 'Checkout Session'}
                  </div>
                  <div className="font-mono text-[10px]">ID: {m.data.id}</div>
                  <div className="mt-1">Status: <span className="font-bold uppercase">{m.data.status}</span></div>
                  {m.data.order?.id && (
                    <div className="mt-1 p-1 bg-green-100 text-green-800 rounded font-bold border border-green-200">
                      Order ID: {m.data.order.id}
                    </div>
                  )}
                  {m.data.cart?.total && (
                    <div className="mt-1 font-bold">
                      Total: {m.data.cart.total.currency} {(m.data.cart.total.amount / 100).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-3 rounded-lg flex items-center gap-2 text-slate-500 italic">
              <Loader2 size={16} className="animate-spin" />
              {step === "merchant" ? "Connecting to merchant..." : "AI is thinking..."}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-slate-50">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                step === "name" ? "Enter your name..." : 
                step === "merchant" ? "Enter Merchant UCP URL (e.g. https://...)" :
                "Type your message..."
              }
              className="w-full p-2 pl-3 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            {step === "merchant" && (
              <Globe className="absolute right-3 top-2.5 text-slate-400" size={18} />
            )}
          </div>
          <button
            id="send-button"
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="text-[10px] text-slate-400 mt-2 text-center">
          Powered by Gemini 2.0 Flash & Universal Commerce Protocol
        </div>
      </div>
    </div>
  );
}
