// apps/api/src/modules/marketplace/marketplace.seed.ts
import type { NewStoreRow, NewProductRow, NewProductFactRow } from '@cidade-virtual/persistence';

export interface SeedProductWithFacts {
  product: NewProductRow;
  facts: Omit<NewProductFactRow, 'id' | 'productId' | 'storeId'>[];
}

export const TOMPETS_STORE: NewStoreRow = {
  id: 'store-tompets',
  name: 'TomPets',
  slug: 'tompets',
  category: 'petshop',
  addressBox: 'Alameda das Nações, Box 04',
  coordinates: { x: 25, y: 0.19, z: -18 },
  themeColors: {
    primary: '#004CBF', // Azul Royal Petz
    secondary: '#0F2C59', // Azul Marinho Profundo
    accent: '#FFD000', // Amarelo Solar Petz
    surface: '#FFFFFF', // Branco puro
    action: '#FF7A00', // Laranja vibrante de ação
  },
  sellerPersona: {
    id: 'agent-tom',
    name: 'Tom',
    role: 'Vendedor Especialista em Nutrição e Cuidados Pet',
    voicePitch: 0.95,
    voiceRate: 1.0,
    greeting: 'Olá! Seja bem-vindo à TomPets. Em que posso ajudar o seu pet hoje?',
  },
};

export const TOMPETS_SEED_PRODUCTS: SeedProductWithFacts[] = [
  // 1. Areia Higiênica Viva Verde Limpeza Plena 4kg
  {
    product: {
      id: 'prod-viva-verde-4kg',
      storeId: 'store-tompets',
      name: 'Areia Higiênica para Gatos Viva Verde Limpeza Plena 4kg',
      slug: 'areia-higienica-viva-verde-limpeza-plena-4kg',
      category: 'gatos',
      condition: 'new',
      conditionDetails: null,
      priceCents: 6890, // R$ 68,90
      currency: 'BRL',
      stockQuantity: 25,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-higiene-gatos', slot: 1 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/151525_1.jpg',
          label: 'Areia Viva Verde 4kg',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'composicao',
        factStatement: 'Areia 100% natural, ecológica e biodegradável, produzida à base de milho e mandioca sustentáveis.',
        sourceId: 'rotulo-viva-verde',
      },
      {
        attributeKey: 'performance',
        factStatement: 'Forma torrões firmes e instantâneos de fácil remoção com pá, sem deixar resíduos no fundo da caixa.',
        sourceId: 'rotulo-viva-verde',
      },
      {
        attributeKey: 'descarte',
        factStatement: 'Pode ser descartada diretamente no vaso sanitário em pequenas quantidades (torrão por torrão).',
        sourceId: 'manual-fabricante-viva-verde',
      },
      {
        attributeKey: 'odor',
        factStatement: 'Eliminação imediata de odores desagradáveis de amônia com fórmula livre de poeira e corantes artificiais.',
        sourceId: 'rotulo-viva-verde',
      },
      {
        attributeKey: 'indicacao',
        factStatement: 'Indicada para gatos de todas as raças e idades, especialmente felinos sensíveis ou com alergias respiratórias.',
        sourceId: 'rotulo-viva-verde',
      },
    ],
  },

  // 2. Bebedouro Fonte de Porcelana Cansei de Ser Gato Bivolt
  {
    product: {
      id: 'prod-fonte-porcelana-csg',
      storeId: 'store-tompets',
      name: 'Bebedouro Fonte de Porcelana Cansei de Ser Gato Bivolt',
      slug: 'bebedouro-fonte-porcelana-cansei-de-ser-gato-bivolt',
      category: 'gatos',
      condition: 'new',
      conditionDetails: null,
      priceCents: 19990, // R$ 199,90
      currency: 'BRL',
      stockQuantity: 12,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-acessorios-gatos', slot: 1 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/182342_1.jpg',
          label: 'Fonte de Porcelana CSG',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'material',
        factStatement: 'Confeccionada em porcelana sanitária esmaltada e atóxica que não absorve cheiros nem bactérias, prevenindo a acne felina.',
        sourceId: 'canseidesergato-oficial',
      },
      {
        attributeKey: 'capacidade',
        factStatement: 'Reservatório com capacidade de 1,5 a 2 litros de água fresca e oxigenada em circulação constante.',
        sourceId: 'manual-tecnico-csg',
      },
      {
        attributeKey: 'voltagem',
        factStatement: 'Bomba submersa bivolt automática silenciosa de baixo consumo elétrico e filtro lavável.',
        sourceId: 'manual-tecnico-csg',
      },
      {
        attributeKey: 'saude_renal',
        factStatement: 'A água corrente atrai o interesse dos gatos pelo movimento, incentivando a hidratação diária e reduzindo riscos de cálculos renais.',
        sourceId: 'canseidesergato-oficial',
      },
    ],
  },

  // 3. Ração Fórmula Natural Fresh Meat Raças Médias e Grandes 15kg
  {
    product: {
      id: 'prod-formula-natural-15kg',
      storeId: 'store-tompets',
      name: 'Ração Fórmula Natural Fresh Meat Cães Adultos Raças Médias e Grandes 15kg',
      slug: 'racao-formula-natural-fresh-meat-caes-adultos-15kg',
      category: 'caes',
      condition: 'new',
      conditionDetails: null,
      priceCents: 34990, // R$ 349,90
      currency: 'BRL',
      stockQuantity: 15,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-alimentos-caes', slot: 1 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/146847_1.jpg',
          label: 'Fórmula Natural Fresh Meat 15kg',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'classificacao',
        factStatement: 'Alimento Super Premium elaborado com carne de frango desossada fresca e selecionada como fonte proteica de alto valor biológico.',
        sourceId: 'adimax-embalagem-oficial',
      },
      {
        attributeKey: 'saude_articular',
        factStatement: 'Contém sulfato de condroitina e sulfato de glicosamina que auxiliam na manutenção e elasticidade das articulações de cães de médio e grande porte.',
        sourceId: 'adimax-embalagem-oficial',
      },
      {
        attributeKey: 'ingredientes_naturais',
        factStatement: 'Sem grãos transgênicos, sem corantes e sem conservantes artificiais, preservada com extrato de alecrim e tocoferóis naturais.',
        sourceId: 'adimax-embalagem-oficial',
      },
      {
        attributeKey: 'flora_intestinal',
        factStatement: 'Enriquecida com prebióticos MOS e FOS que estimulam o equilíbrio da microbiota intestinal e fezes com odor reduzido.',
        sourceId: 'adimax-embalagem-oficial',
      },
    ],
  },

  // 4. Areia Higiênica Pipicat Classic para Gatos 4kg
  {
    product: {
      id: 'prod-pipicat-classic-4kg',
      storeId: 'store-tompets',
      name: 'Areia Higiênica Pipicat Classic para Gatos 4kg',
      slug: 'areia-higienica-pipicat-classic-para-gatos-4kg',
      category: 'gatos',
      condition: 'new',
      conditionDetails: null,
      priceCents: 1890, // R$ 18,90
      currency: 'BRL',
      stockQuantity: 50,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-higiene-gatos', slot: 2 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/79747_1.jpg',
          label: 'Pipicat Classic 4kg',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'material',
        factStatement: 'Composta por argila esmectita/bentonita natural pura que absorve líquidos em segundos formando torrões consistentes.',
        sourceId: 'kelco-pipicat-embalagem',
      },
      {
        attributeKey: 'custo_beneficio',
        factStatement: 'Produto consagrado com excelente rendimento para lares com um ou múltiplos gatos.',
        sourceId: 'kelco-pipicat-embalagem',
      },
      {
        attributeKey: 'odor',
        factStatement: 'Controle eficaz de odores com cheiro suave de terra que respeita o olfato apurado dos felinos.',
        sourceId: 'kelco-pipicat-embalagem',
      },
    ],
  },

  // 5. Ração PremieR Nutrição Clínica Hipoalergênico Cães Médio e Grande Porte 10,1kg
  {
    product: {
      id: 'prod-premier-hipoalergenico-10kg',
      storeId: 'store-tompets',
      name: 'Ração PremieR Nutrição Clínica Hipoalergênico Cães Médio e Grande Porte 10,1kg',
      slug: 'racao-premier-nutricao-clinica-hipoalergenico-10kg',
      category: 'caes',
      condition: 'new',
      conditionDetails: null,
      priceCents: 38990, // R$ 389,90
      currency: 'BRL',
      stockQuantity: 8,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-alimentos-especiais', slot: 1 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/156514_1.jpg',
          label: 'PremieR Hipoalergênico 10,1kg',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'finalidade_clinica',
        factStatement: 'Alimento coadjuvante desenvolvido especificamente para cães com reações adversas a alimentos com manifestações dermatológicas ou gastrintestinais.',
        sourceId: 'premier-pet-nutricao-clinica',
      },
      {
        attributeKey: 'proteina_hidrolisada',
        factStatement: 'Fonte exclusiva de proteína de soja hidrolisada com baixo peso molecular (< 3.000 Daltons) que não é reconhecida pelos anticorpos alérgicos do cão.',
        sourceId: 'premier-pet-nutricao-clinica',
      },
      {
        attributeKey: 'barreira_cutanea',
        factStatement: 'Níveis concentrados de ácidos graxos ômega 3 e ômega 6 com zinco quelatado para reparação e fortalecimento da integridade da barreira cutânea.',
        sourceId: 'premier-pet-nutricao-clinica',
      },
      {
        attributeKey: 'recomendacao',
        factStatement: 'Este produto deve ser utilizado exclusivamente sob orientação e acompanhamento de um médico-veterinário.',
        sourceId: 'premier-pet-nutricao-clinica',
      },
    ],
  },

  // 6. Ração Golden Formula Mini Bits Cães Pequeno Porte Carne e Arroz
  {
    product: {
      id: 'prod-golden-mini-bits',
      storeId: 'store-tompets',
      name: 'Ração Golden Formula Mini Bits Cães Adultos Pequeno Porte Carne e Arroz',
      slug: 'racao-golden-formula-mini-bits-caes-pequeno-porte-carne-e-arroz',
      category: 'caes',
      condition: 'new',
      conditionDetails: null,
      priceCents: 17490, // R$ 174,90
      currency: 'BRL',
      stockQuantity: 20,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-alimentos-caes', slot: 2 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/95494_1.jpg',
          label: 'Golden Mini Bits Carne e Arroz',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'tamanho_grao',
        factStatement: 'Partículas mini bits especialmente projetadas para a boca e mastigação anatômica de cães de porte pequeno e miniatura.',
        sourceId: 'premier-golden-oficial',
      },
      {
        attributeKey: 'odor_fezes',
        factStatement: 'Formulação com extrato de Yucca que reduz expressivamente o odor das fezes em ambientes internos.',
        sourceId: 'premier-golden-oficial',
      },
      {
        attributeKey: 'sabor',
        factStatement: 'Sabor clássico de carne e arroz de altíssima aceitação palatável, sem corantes e sem aromatizantes químicos.',
        sourceId: 'premier-golden-oficial',
      },
    ],
  },

  // 7. Ração GranPlus Gourmet Cães Médio e Grande Porte Sabor Ovelha e Arroz 15kg
  {
    product: {
      id: 'prod-granplus-gourmet-ovelha-15kg',
      storeId: 'store-tompets',
      name: 'Ração GranPlus Gourmet Cães Adultos Médio e Grande Porte Sabor Ovelha e Arroz 15kg',
      slug: 'racao-granplus-gourmet-caes-medio-e-grande-porte-ovelha-15kg',
      category: 'caes',
      condition: 'new',
      conditionDetails: null,
      priceCents: 18990, // R$ 189,90
      currency: 'BRL',
      stockQuantity: 18,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-alimentos-caes', slot: 3 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/153716_1.jpg',
          label: 'GranPlus Gourmet Ovelha 15kg',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'linha',
        factStatement: 'Linha High Premium Gourmet com sabor diferenciado de ovelha e arroz para cães com paladar exigente.',
        sourceId: 'granplus-affinity-oficial',
      },
      {
        attributeKey: 'proteina',
        factStatement: 'Proteínas nobres de fácil digestão com fibras funcionais e polpa de beterraba para fezes firmes.',
        sourceId: 'granplus-affinity-oficial',
      },
      {
        attributeKey: 'pele_e_pelagem',
        factStatement: 'Enriquecida com fontes naturais de ômega 3 e 6 que garantem maciez e brilho intenso à pelagem.',
        sourceId: 'granplus-affinity-oficial',
      },
    ],
  },

  // 8. Produto Usado / Oportunidade: Bebedouro Fonte de Porcelana Cansei de Ser Gato [SEMI-NOVO]
  {
    product: {
      id: 'prod-fonte-porcelana-csg-usada',
      storeId: 'store-tompets',
      name: 'Bebedouro Fonte de Porcelana Cansei de Ser Gato [SEMI-NOVO]',
      slug: 'bebedouro-fonte-porcelana-cansei-de-ser-gato-semi-novo',
      category: 'gatos',
      condition: 'used',
      conditionDetails: 'Item semi-novo revisado pela loja. Utilizado por apenas 30 dias. Porcelana sem trincas nem arranhões, bomba motorizada testada e higienizada com filtro novinho incluso.',
      priceCents: 9900, // R$ 99,00 (Desconto de mais de 50% em relação ao novo de R$ 199,90)
      currency: 'BRL',
      stockQuantity: 1,
      status: 'active',
      shelfLocation: { shelfId: 'gondola-oportunidades-usados', slot: 1 },
      media: [
        {
          type: 'image',
          url: 'https://images.petz.com.br/fotos/182342_1.jpg',
          label: 'Fonte Porcelana Semi-Nova TomPets',
        },
      ],
    },
    facts: [
      {
        attributeKey: 'condicao',
        factStatement: 'Produto usado certificado pela equipe TomPets: sem trincas, testado e com higienização hospitalar.',
        sourceId: 'laudo-inspecao-tompets-01',
      },
      {
        attributeKey: 'garantia_usado',
        factStatement: 'A TomPets oferece garantia balcão de 30 dias para a bomba motorizada de itens de oportunidade.',
        sourceId: 'politica-garantia-tompets',
      },
      {
        attributeKey: 'economia',
        factStatement: 'Economia direta de mais de 50% em comparação ao mesmo item novo em gôndola.',
        sourceId: 'politica-precos-tompets',
      },
    ],
  },
];
