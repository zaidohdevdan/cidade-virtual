import React, { useState, useEffect, useRef } from 'react';
import { AgentAvatar, type LearnedDirectiveClient } from '../avatars/agent-avatar';

export interface DialogueMessage {
  id: string;
  sender: 'player' | 'agent';
  senderName: string;
  text: string;
  time: string;
  directive?: LearnedDirectiveClient;
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
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fechar ao clicar fora do widget de chat (sem necessidade de overlay escuro bloqueando a cena)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        // Evita fechar se o clique tiver ocorrido no card de prompt de abertura
        const target = e.target as HTMLElement;
        if (target.closest('.dialogue-prompt-card')) return;
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
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
    'Você deve evitar o café',
    'Atravesse pela faixa de pedestres',
    'Vá para o mercado',
    'Caminhe até a praça',
    'Pare aqui',
    'Como está o trânsito agora?',
    'Regras principais da praça?',
  ];

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-label={`Chat com ${agent.config.name}`}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        height: '520px',
        maxHeight: 'calc(100vh - 40px)',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '18px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 25px rgba(56, 189, 248, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: '#f8fafc',
        zIndex: 1000,
        animation: 'chatSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onKeyDown={(e) => e.stopPropagation()} // Impede WASD de andar enquanto digita
    >
      {/* Header do Widget de Chat */}
      <div
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: agent.config.labelColor || 'linear-gradient(135deg, #2563eb, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              border: '2px solid rgba(255, 255, 255, 0.35)',
              flexShrink: 0,
            }}
          >
            🚶
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.2px' }}>
                {agent.config.name}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.18)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  fontWeight: 600,
                }}
              >
                {agent.config.starDesignation}
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                marginTop: '1px',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
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
            width: '28px',
            height: '28px',
            color: '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            marginLeft: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
            e.currentTarget.style.color = '#fca5a5';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#cbd5e1';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
          title="Fechar chat (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Histórico de Mensagens */}
      <div
        style={{
          flex: 1,
          padding: '14px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'radial-gradient(ellipse at top, rgba(30, 41, 59, 0.35) 0%, rgba(15, 23, 42, 0.95) 100%)',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
            <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '2px' }}>
              Conversar com {agent.config.name}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              Habitante autônomo com memória e consciência situacional.
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
                  fontSize: '9.5px',
                  fontWeight: 600,
                  color: isPlayer ? '#38bdf8' : '#94a3b8',
                  marginBottom: '2px',
                  padding: '0 4px',
                }}
              >
                {m.senderName} • {m.time}
              </div>
              <div
                style={{
                  maxWidth: '86%',
                  padding: '8px 12px',
                  borderRadius: isPlayer ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: isPlayer
                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                    : 'rgba(30, 41, 59, 0.85)',
                  border: isPlayer
                    ? '1px solid rgba(56, 189, 248, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  fontSize: '12.5px',
                  lineHeight: '1.4',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  wordBreak: 'break-word',
                }}
              >
                {m.text}
                {m.directive && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#7dd3fc',
                      fontWeight: 600,
                    }}
                  >
                    <span>⚡</span>
                    <span>
                      Diretiva Fixada: <strong>{m.directive.description}</strong> (Qdrant & PostgreSQL)
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#38bdf8',
              fontSize: '11.5px',
              padding: '4px 8px',
            }}
          >
            <div style={{ display: 'inline-block', animation: 'spin 1s infinite linear' }}>⬡</div>
            <span>{agent.config.name} está deliberando...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões Rápidas (Chips Horizontais) */}
      <div
        style={{
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.90)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
        }}
      >
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(p)}
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '4px 9px',
              fontSize: '10.5px',
              color: '#cbd5e1',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)';
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
              e.currentTarget.style.color = '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
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
          padding: '10px 12px',
          background: 'rgba(15, 23, 42, 0.98)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={`Conversar com ${agent.config.name}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '12.5px',
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
            borderRadius: '10px',
            padding: '0 14px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
            transition: 'transform 0.1s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Enviar
        </button>
      </form>
    </div>
  );
};
