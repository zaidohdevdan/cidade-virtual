import React, { useState } from 'react';
import { DanielAvatar, AvatarCustomizationConfig, AVATAR_PALETTE } from '../avatars/daniel-avatar';
import { loginWithGoogle, saveAvatarConfig } from '../services/api';

interface AvatarCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: DanielAvatar;
  token?: string | null;
  currentUser?: { displayName?: string; email?: string } | null;
  onLoginSuccess?: (data: { token: string; profile: { id?: string; avatarConfig?: AvatarCustomizationConfig; displayName?: string; email?: string } }) => void;
}

const PRESET_PRIMARY_COLORS = [
  { name: 'Azul Streetwear (Padrão)', hex: AVATAR_PALETTE.JACKET_BLUE },
  { name: 'Azul Petz', hex: '#004CBF' },
  { name: 'Laranja Petz', hex: '#FF7A00' },
  { name: 'Azul Marinho', hex: '#0F2C59' },
  { name: 'Verde Esmeralda', hex: '#10B981' },
  { name: 'Vermelho Carmim', hex: '#EF4444' },
  { name: 'Roxo Cyber', hex: '#8B5CF6' },
];

const PRESET_SECONDARY_COLORS = [
  { name: 'Amarelo Vibrante (Padrão)', hex: AVATAR_PALETTE.PANTS_YELLOW },
  { name: 'Amarelo Petz', hex: '#FFD000' },
  { name: 'Off-White', hex: '#F8FAFC' },
  { name: 'Grafite Escuro', hex: '#1E293B' },
  { name: 'Ciano Neon', hex: '#06B6D4' },
];

const SKIN_TONES = [AVATAR_PALETTE.SKIN, '#f5cfb3', '#8d5524', '#c68642', '#e0ac69', '#ffd1aa'];
const HAIR_COLORS = [AVATAR_PALETTE.HAIR, '#241c18', '#9a6b43', '#dcd0ba', '#e74c3c', '#1e293b'];

export const AvatarCustomizerModal: React.FC<AvatarCustomizerModalProps> = ({
  isOpen,
  onClose,
  player,
  token,
  currentUser,
  onLoginSuccess,
}) => {
  const [primaryColor, setPrimaryColor] = useState<string>(player.currentConfig.primaryColor || '#004CBF');
  const [secondaryColor, setSecondaryColor] = useState<string>(player.currentConfig.secondaryColor || '#FFD000');
  const [skinTone, setSkinTone] = useState<string>(player.currentConfig.skinTone || '#f5cfb3');
  const [hairColor, setHairColor] = useState<string>(player.currentConfig.hairColor || '#241c18');
  const [hasGlasses, setHasGlasses] = useState<boolean>(
    player.currentConfig.accessories?.includes('glasses') ?? true
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Estados de login com Google / Simulação Dev
  const [mockEmail, setMockEmail] = useState<string>('visitante@gmail.com');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  if (!isOpen) return null;

  const updateAvatarPreview = (updated: Partial<AvatarCustomizationConfig>) => {
    const nextConfig: AvatarCustomizationConfig = {
      model: player.currentConfig.model || 'casual_male_1',
      primaryColor: updated.primaryColor ?? primaryColor,
      secondaryColor: updated.secondaryColor ?? secondaryColor,
      skinTone: updated.skinTone ?? skinTone,
      hairColor: updated.hairColor ?? hairColor,
      accessories: (updated.accessories !== undefined)
        ? updated.accessories
        : (hasGlasses ? ['glasses'] : []),
    };
    player.applyConfig(nextConfig);
  };

  const handlePrimaryChange = (hex: string) => {
    setPrimaryColor(hex);
    updateAvatarPreview({ primaryColor: hex });
  };

  const handleSecondaryChange = (hex: string) => {
    setSecondaryColor(hex);
    updateAvatarPreview({ secondaryColor: hex });
  };

  const handleSkinChange = (hex: string) => {
    setSkinTone(hex);
    updateAvatarPreview({ skinTone: hex });
  };

  const handleHairChange = (hex: string) => {
    setHairColor(hex);
    updateAvatarPreview({ hairColor: hex });
  };

  const handleGlassesToggle = () => {
    const next = !hasGlasses;
    setHasGlasses(next);
    updateAvatarPreview({ accessories: next ? ['glasses'] : [] });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const config: AvatarCustomizationConfig = {
        model: 'casual_male_1',
        primaryColor,
        secondaryColor,
        skinTone,
        hairColor,
        accessories: hasGlasses ? ['glasses'] : [],
      };

      if (token) {
        await saveAvatarConfig(token, config);
      }
      setSaveMessage('Avatar salvo com sucesso!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: unknown) {
      setSaveMessage(`Falha ao salvar: ${(err as Error)?.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMockGoogleLogin = async () => {
    setIsLoggingIn(true);
    setSaveMessage(null);
    try {
      const data = await loginWithGoogle(mockEmail);

      if (data.profile?.avatarConfig) {
        const loaded = data.profile.avatarConfig as AvatarCustomizationConfig;
        if (loaded.primaryColor) setPrimaryColor(loaded.primaryColor);
        if (loaded.secondaryColor) setSecondaryColor(loaded.secondaryColor);
        if (loaded.skinTone) setSkinTone(loaded.skinTone);
        if (loaded.hairColor) setHairColor(loaded.hairColor);
        setHasGlasses(loaded.accessories?.includes('glasses') ?? true);
        player.applyConfig(loaded);
      }

      if (onLoginSuccess) {
        onLoginSuccess({
          token: data.token,
          profile: {
            id: data.profile?.id || data.user.userId,
            displayName: data.profile?.displayName || mockEmail.split('@')[0],
            email: data.profile?.email || mockEmail,
            avatarConfig: data.profile?.avatarConfig,
          },
        });
      }
      setSaveMessage(`Logado como ${data.profile?.displayName || mockEmail}!`);
    } catch (err: unknown) {
      setSaveMessage(`Erro no login: ${(err as Error)?.message || String(err)}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderRadius: '16px',
          border: '1px solid #1e293b',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxWidth: '520px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0B132B',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFD000' }}>
              🎨 Personalizar Avatar & Acesso
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Escolha suas cores e identidade para explorar a Cidade Virtual
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Seção Login Google */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid #334155',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#38bdf8' }}>
              👤 Identidade (Google OIDC)
            </div>
            {currentUser?.email ? (
              <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                Conectado como: <strong>{currentUser.displayName || currentUser.email}</strong> ({currentUser.email})
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#cbd5e1' }}>
                  Entre com seu Gmail para sincronizar seu avatar e compras:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    value={mockEmail}
                    onChange={(e) => setMockEmail(e.target.value)}
                    placeholder="seu.email@gmail.com"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #475569',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    onClick={handleMockGoogleLogin}
                    disabled={isLoggingIn}
                    style={{
                      backgroundColor: '#004CBF',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seletor Cor Principal (Jaqueta / Vestuário) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              🧥 Cor da Jaqueta / Traje Principal
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_PRIMARY_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => handlePrimaryChange(c.hex)}
                  title={c.name}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: c.hex,
                    border: primaryColor.toLowerCase() === c.hex.toLowerCase() ? '3px solid #FFD000' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Seletor Cor Secundária (Calça / Detalhes) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              👖 Cor da Calça / Detalhes Secundários
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_SECONDARY_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => handleSecondaryChange(c.hex)}
                  title={c.name}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: c.hex,
                    border: secondaryColor.toLowerCase() === c.hex.toLowerCase() ? '3px solid #FFD000' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tom de Pele */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              🧑 Tom de Pele
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {SKIN_TONES.map((hex) => (
                <button
                  key={hex}
                  onClick={() => handleSkinChange(hex)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: hex,
                    border: skinTone.toLowerCase() === hex.toLowerCase() ? '3px solid #FFD000' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Cor de Cabelo */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              💇 Cabelo
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {HAIR_COLORS.map((hex) => (
                <button
                  key={hex}
                  onClick={() => handleHairChange(hex)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: hex,
                    border: hairColor.toLowerCase() === hex.toLowerCase() ? '3px solid #FFD000' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Acessórios */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              🕶️ Acessórios
            </label>
            <button
              onClick={handleGlassesToggle}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: hasGlasses ? '#004CBF' : '#334155',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {hasGlasses ? '✓ Óculos Cyber Ativados' : 'Desativar Óculos'}
            </button>
          </div>

          {saveMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: saveMessage.includes('sucesso') || saveMessage.includes('Logado') ? '#065f46' : '#991b1b',
                color: '#ffffff',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {saveMessage}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#0B132B',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              backgroundColor: '#FF7A00', // Laranja vibrante de ação
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {isSaving ? 'Salvando...' : 'Confirmar Avatar'}
          </button>
        </div>
      </div>
    </div>
  );
};
