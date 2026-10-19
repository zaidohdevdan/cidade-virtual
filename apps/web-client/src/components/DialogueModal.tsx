import React, { useState, useEffect, useRef } from 'react';
import { AgentAvatar } from '../avatars/agent-avatar';

export interface DialogueMessage {
  id: string;
  sender: 'player' | 'agent';
  senderName: string;
  text: string;
  time: string;
}

interface DialogueModalProps {
  agent: AgentAvatar | null;
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  messages: DialogueMessage[];
  isThinking?: boolean;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  agent,
  isOpen,
  onClose,
  onSendMessage,
  messages,
  isThinking = false,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !agent) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const quickPrompts = [
    'Como está o trânsito e o semáforo agora?',
    'Quais são as principais regras da praça?',
    'O que você acha da vida nesta cidade?',
    'A faixa de pedestres está liberada para travessia?',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5, 10, 20, 0.65)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '560px',
          height: '620px',
          maxHeight: '90vh',
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          border: '1.5px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          color: '#f8fafc',
        }}
        onKeyDown={(e) => e.stopPropagation()} // Impede WASD de andar enquanto digita
      >
        {/* Header do Diálogo */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: agent.config.labelColor || 'linear-gradient(135deg, #2563eb, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.4)',
              }}
            >
              🚶
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '0.3px' }}>
                  {agent.config.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.18)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    fontWeight: 600,
                  }}
                >
                  {agent.config.starDesignation}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                {agent.config.role}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s ease',
            }}
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Histórico de Mensagens */}
        <div
          style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            background: 'radial-gradient(ellipse at top, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%)',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '13px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
              <div>Inicie uma conversa com {agent.config.name}.</div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                Este habitante possui consciência situacional, metas e memórias ativas.
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isPlayer = m.sender === 'player';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isPlayer ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: isPlayer ? '#38bdf8' : '#94a3b8',
                    marginBottom: '3px',
                    padding: '0 4px',
                  }}
                >
                  {m.senderName} • {m.time}
                </div>
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '10px 14px',
                    borderRadius: isPlayer ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isPlayer
                      ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                      : 'rgba(30, 41, 59, 0.85)',
                    border: isPlayer
                      ? '1px solid rgba(56, 189, 248, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '13px',
                    lineHeight: '1.45',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px' }}>
              <div style={{ display: 'inline-block', animation: 'spin 1s infinite linear' }}>⬡</div>
              <span>{agent.config.name} está deliberando...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões Rápidas */}
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(15, 23, 42, 0.85)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(p)}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '5px 10px',
                fontSize: '11px',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.color = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Campo de Envio */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '12px 16px',
            background: 'rgba(15, 23, 42, 0.98)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: '10px',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder={`Conversar com ${agent.config.name}... (Pressione Enter para enviar)`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.18)')}
          />
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              border: 'none',
              borderRadius: '12px',
              padding: '0 18px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};
