import React from 'react';
import { Plus, MessageSquare, Trash2, Download, X, Search, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

export function Sidebar({
    isOpen,
    setIsOpen,
    conversations,
    currentId,
    onSelect,
    onNew,
    onDelete,
    onExport
}) {
    // Sort by recent
    const sortedConversations = Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={clsx(
                    "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity md:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Panel */}
            <div className={clsx(
                "fixed inset-y-0 left-0 z-50 w-80 bg-surface/95 backdrop-blur-xl border-r border-border shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
                    <h2 className="font-bold text-white flex items-center gap-3 text-lg">
                        <MessageSquare size={22} className="text-primary" />
                        Conversation History
                    </h2>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-4 border-b border-white/5 shrink-0">
                    <button
                        onClick={() => { onNew(); if (window.innerWidth < 768) setIsOpen(false); }}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white hover:brightness-110 shadow-lg shadow-primary/20 rounded-xl py-3 px-4 font-bold transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        New Chat
                    </button>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {sortedConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-sm gap-2 opacity-60">
                            <MessageSquare size={32} />
                            <p>No history yet</p>
                        </div>
                    ) : (
                        sortedConversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() => { onSelect(conv.id); if (window.innerWidth < 768) setIsOpen(false); }}
                                className={clsx(
                                    "p-4 rounded-xl cursor-pointer border transition-all group relative pr-12",
                                    currentId === conv.id
                                        ? "bg-white/10 border-primary/30 text-white shadow-md"
                                        : "bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200"
                                )}
                            >
                                <div className="flex flex-col gap-1">
                                    <h4 className="font-medium text-sm truncate leading-snug">
                                        {conv.preview || "Empty Conversation"}
                                    </h4>
                                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-50">
                                        {new Date(conv.updatedAt).toLocaleDateString()} • {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>

                                {/* Actions - Fixed Position & Appearance */}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex flex-row items-center bg-gray-900/90 backdrop-blur rounded-lg border border-white/10 shadow-xl overflow-hidden">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onExport(conv.id); }}
                                        className="p-2 hover:bg-white/10 hover:text-primary transition-colors border-r border-white/10"
                                        title="Export"
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                                        className="p-2 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer/Info */}
                <div className="p-4 border-t border-white/5 text-[10px] text-center text-gray-600 uppercase tracking-widest shrink-0">
                    MasriConnect v1.0
                </div>
            </div>
        </>
    );
}
