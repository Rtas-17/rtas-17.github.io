import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Bot, User, Pencil } from 'lucide-react';

const SpeakerBadge = ({ speakerId, name, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(name);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (tempName.trim()) {
            onRename(tempName.trim());
        } else {
            setTempName(name); // Revert if empty
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setTempName(name);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="text-xs font-bold text-primary mb-1 block uppercase tracking-wider bg-transparent border-b border-primary outline-none min-w-[60px]"
            />
        );
    }

    return (
        <span
            className="text-xs font-bold text-primary mb-1 block uppercase tracking-wider cursor-pointer hover:underline flex items-center gap-2 group"
            onDoubleClick={() => setIsEditing(true)}
            onContextMenu={(e) => { e.preventDefault(); setIsEditing(true); }} // Long tap often triggers context menu on mobile
            onTouchEnd={(e) => {
                // Simple double tap simulation or long press could be complex. 
                // ContextMenu is a safe bet for "Long Press" on many mobile browsers.
                // Alternatively, we can just use a small edit icon.
            }}
        >
            {name}
            <Pencil size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
        </span>
    );
};

export function LiveTranscript({ messages, currentTranscript, currentTranslation, speakerNames = {}, onRenameSpeaker }) {
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
                        {msg.speaker && (
                            <SpeakerBadge
                                speakerId={msg.speaker}
                                name={speakerNames[msg.speaker] || `Speaker ${msg.speaker}`}
                                onRename={(newName) => onRenameSpeaker(msg.speaker, newName)}
                            />
                        )}
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
