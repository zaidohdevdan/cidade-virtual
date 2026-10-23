// apps/web-client/src/components/ProductDetailModal.tsx
import React, { useEffect } from 'react';
import { InteriorProductData, formatBRLFromCents } from '../scenes/tompets-interior';

interface ProductDetailModalProps {
  product: InteriorProductData | null;
  isOpen: boolean;
  onClose: () => void;
  onAskAgentTom: (product: InteriorProductData) => void;
  onCheckout: (product: InteriorProductData) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onAskAgentTom,
  onCheckout,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const priceBRL = formatBRLFromCents(product.priceCents);
  const isUsed = product.condition === 'used';

  // Fatos e especificações canônicas vinculadas ao ID do produto
  const productFactsMap: Record<string, { key: string; statement: string; source: string }[]> = {
    'prod-viva-verde-4kg': [
      { key: 'Composição', statement: '100% natural, ecológica e biodegradável, à base de milho e mandioca sustentáveis.', source: 'rotulo-viva-verde' },
      { key: 'Performance', statement: 'Forma torrões firmes e instantâneos de fácil remoção com pá, sem resíduos.', source: 'rotulo-viva-verde' },
      { key: 'Descarte', statement: 'Pode ser descartada diretamente no vaso sanitário em pequenas quantidades.', source: 'manual-fabricante-viva-verde' },
      { key: 'Odores', statement: 'Eliminação imediata de odores de amônia com fórmula livre de poeira e corantes.', source: 'rotulo-viva-verde' },
    ],
    'prod-fonte-porcelana-csg': [
      { key: 'Material', statement: 'Porcelana sanitária esmaltada e atóxica que previne a acne felina.', source: 'canseidesergato-oficial' },
      { key: 'Capacidade', statement: 'Reservatório com capacidade de 1,5 a 2 litros de água fresca em circulação.', source: 'manual-tecnico-csg' },
      { key: 'Voltagem', statement: 'Bomba submersa bivolt automática silenciosa de baixo consumo e filtro lavável.', source: 'manual-tecnico-csg' },
      { key: 'Saúde Renal', statement: 'Água corrente incentiva hidratação diária prevenindo cálculos renais.', source: 'canseidesergato-oficial' },
    ],
    'prod-formula-natural-15kg': [
      { key: 'Classificação', statement: 'Alimento Super Premium elaborado com carne de frango desossada fresca.', source: 'adimax-embalagem-oficial' },
      { key: 'Saúde Articular', statement: 'Condroitina e glicosamina para manutenção e elasticidade das articulações.', source: 'adimax-embalagem-oficial' },
      { key: 'Ingredientes', statement: 'Sem grãos transgênicos, conservada com extrato de alecrim e tocoferóis naturais.', source: 'adimax-embalagem-oficial' },
    ],
    'prod-pipicat-classic-4kg': [
      { key: 'Material', statement: 'Argila bentonita pura que absorve líquidos em segundos formando torrões consistentes.', source: 'kelco-pipicat-embalagem' },
      { key: 'Custo-benefício', statement: 'Excelente rendimento para lares com um ou múltiplos felinos.', source: 'kelco-pipicat-embalagem' },
      { key: 'Odor', statement: 'Controle eficaz de odores com cheiro suave de terra que respeita o olfato felino.', source: 'kelco-pipicat-embalagem' },
    ],
    'prod-premier-hipoalergenico-10kg': [
      { key: 'Finalidade Clínica', statement: 'Desenvolvido para cães com reações adversas a alimentos (dermatológicas/intestinais).', source: 'premier-pet-nutricao-clinica' },
      { key: 'Proteína Hidrolisada', statement: 'Proteína de soja hidrolisada com baixo peso molecular (< 3.000 Da) anti-alérgica.', source: 'premier-pet-nutricao-clinica' },
      { key: 'Prescrição', statement: 'Alimento coadjuvante. Recomendado acompanhamento de médico-veterinário.', source: 'premier-pet-nutricao-clinica' },
    ],
    'prod-golden-mini-bits': [
      { key: 'Grão Especial', statement: 'Partículas mini bits especialmente projetadas para mastigação de raças pequenas.', source: 'premier-golden-oficial' },
      { key: 'Odor Reduzido', statement: 'Extrato de Yucca que reduz expressivamente o odor das fezes em ambientes internos.', source: 'premier-golden-oficial' },
      { key: 'Sabor', statement: 'Sabor carne e arroz sem corantes e sem aromatizantes químicos.', source: 'premier-golden-oficial' },
    ],
    'prod-granplus-gourmet-ovelha-15kg': [
      { key: 'Linha Gourmet', statement: 'High Premium Gourmet com sabor diferenciado de ovelha e arroz para paladar exigente.', source: 'granplus-affinity-oficial' },
      { key: 'Digestibilidade', statement: 'Proteínas nobres de fácil absorção com polpa de beterraba para fezes firmes.', source: 'granplus-affinity-oficial' },
      { key: 'Pelagem', statement: 'Ômegas 3 e 6 para maciez e brilho intenso à pelagem.', source: 'granplus-affinity-oficial' },
    ],
    'prod-fonte-porcelana-csg-usada': [
      { key: 'Laudo de Inspeção', statement: 'Semi-novo revisado pela loja: porcelana impecável sem trincas, bomba testada e higienizada com filtro novinho.', source: 'laudo-inspecao-tompets-01' },
      { key: 'Garantia Loja', statement: 'Garantia balcão de 30 dias da TomPets para a bomba elétrica.', source: 'politica-garantia-tompets' },
      { key: 'Economia', statement: 'Mais de 50% de desconto em comparação ao preço de gôndola do item novo.', source: 'politica-precos-tompets' },
    ],
  };

  const facts = productFactsMap[product.id] || [];

  return (
    <div
      className="modal-backdrop active"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="product-detail-card"
        style={{
          width: '92%',
          maxWidth: '560px',
          maxHeight: '88vh',
          background: 'linear-gradient(135deg, #0f2c59 0%, #004cbf 100%)',
          border: '2px solid #ffd000',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 208, 0, 0.25)',
          color: '#ffffff',
          overflowY: 'auto',
          padding: '24px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Loja */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🐾</span>
            <div>
              <div style={{ fontSize: '11px', color: '#ffd000', fontWeight: 800, letterSpacing: '1px' }}>
                TOMPETS • BOX 04 (ALAMEDA DAS NAÇÕES)
              </div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>
                Catálogo Físico e Grounding RAG
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#ffffff',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease',
            }}
            title="Fechar (ESC)"
          >
            &times;
          </button>
        </div>

        {/* Badges de Condição e Categoria */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              background: isUsed ? '#ff7a00' : '#10b981',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {isUsed ? '🏷️ Oportunidade Semi-Nova' : '✨ Produto Novo'}
          </span>
          <span
            style={{
              background: '#0f2c59',
              color: '#ffd000',
              border: '1px solid #ffd000',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '12px',
            }}
          >
            {product.category === 'gatos' ? '🐱 Higiene e Acessórios Felinos' : '🐶 Nutrição Canina Super Premium'}
          </span>
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '12px',
            }}
          >
            ✓ Estoque: {product.stockQuantity} un
          </span>
        </div>

        {/* Título do Produto */}
        <h2 style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.3, marginBottom: '14px', color: '#ffffff' }}>
          {product.name}
        </h2>

        {/* Preço de Gôndola em Alto Destaque */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 44, 89, 0.9), rgba(0, 76, 191, 0.8))',
            border: '2px solid #ffd000',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>PREÇO DE GÔNDOLA</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffd000' }}>
              {priceBRL}
            </div>
            {isUsed && (
              <div style={{ fontSize: '12px', color: '#ffedd5', marginTop: '2px' }}>
                Novo similar: <s>R$ 199,90</s> (Economia direta de mais de 50%)
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Condição</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              {isUsed ? 'Semi-novo revisado' : 'Lacrado de fábrica'}
            </div>
          </div>
        </div>

        {/* Fatos Estruturados com Citação de Fontes Verificáveis */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#ffd000', marginBottom: '8px', letterSpacing: '0.5px' }}>
            ESPECIFICAÇÕES & FATOS CONFIRMADOS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {facts.map((fact, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#93c5fd' }}>
                    {fact.key}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    [{fact.source}]
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.4 }}>
                  {fact.statement}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botões de Ação Multimodais */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onAskAgentTom(product)}
            style={{
              flex: '1 1 200px',
              background: 'linear-gradient(135deg, #004cbf, #0284c7)',
              border: '1.5px solid #ffd000',
              borderRadius: '14px',
              padding: '12px 18px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(0, 76, 191, 0.4)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            title="Abrir chat fundamentado com o vendedor Tom sobre este produto"
          >
            <span>💬</span>
            <span>Perguntar ao Vendedor Tom</span>
          </button>

          <button
            onClick={() => onCheckout(product)}
            style={{
              flex: '1 1 200px',
              background: 'linear-gradient(135deg, #ff7a00, #ea580c)',
              border: '1.5px solid #ffffff',
              borderRadius: '14px',
              padding: '12px 18px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(255, 122, 0, 0.4)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            title="Ir para o pagamento fora da plataforma com Mercado Pago"
          >
            <span>💳</span>
            <span>Comprar (Mercado Pago)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
