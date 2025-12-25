import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Bot, User } from 'lucide-react';

export function LiveTranscript({ messages, currentTranscript, currentTranslation }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentTranscript]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg, idx) => (
                <div key={idx} className={clsx("flex flex-col gap-2 max-w-[85%]", msg.role === 'user' ? "ml-auto" : "mr-auto")}>
                    <div className={clsx(
                        "p-4 rounded-2xl shadow-lg border border-border/50",
                        msg.role === 'user' ? "bg-surface text-text-main rounded-tr-sm" : "bg-primary/10 text-text-main rounded-tl-sm"
                    )}>
                        <p className="text-lg font-medium leading-relaxed">{msg.text}</p>

                        {msg.translation && (
                            <div className="mt-4 pt-3 border-t border-white/10 text-right">
                                <p className="text-xl font-arabic text-primary font-bold">{msg.translation.arabic}</p>
                                <p className="text-sm font-mono text-text-muted mt-1 opacity-80">{msg.translation.phonetic}</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Rolling Interim Transcript */}
            {(currentTranscript) && (
                <div className="flex flex-col gap-2 max-w-[85%] ml-auto animate-pulse">
                    <div className="p-4 rounded-2xl rounded-tr-sm bg-surface/50 border border-border/30 text-text-muted">
                        <p className="text-lg italic mb-2">{currentTranscript}...</p>
                        {currentTranslation && (
                            <div className="text-right">
                                <p className="text-xl font-bold text-primary" dir="rtl">{currentTranslation.arabic}</p>
                                <p className="text-sm font-mono text-text-muted/80">{currentTranslation.phonetic}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    );
}
