
import { AppSettings } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  discountPercent: 5, // Default 5% discount
  pixKeys: [
    { id: '1', name: 'BV Caixa', percent: 50 },
    { id: '2', name: 'Vale Alimentação', percent: 20 },
    { id: '3', name: 'Reserva', percent: 5 },
    { id: '4', name: 'Pagbank Salário', percent: 25 },
  ],
  categories: [
    { id: '1', name: '10 fotos /Ensaio "Livre escolha"', defaultValue: 75 },
    { id: '2', name: '24 fotos /Ensaio ESSÊNCIA', defaultValue: 199 },
    { id: '3', name: '15 fotos /Ensaio "Luma"', defaultValue: 110 },
    { id: '4', name: 'Aniver. infantil (4x via Pix)', defaultValue: 340 },
    { id: '5', name: 'Festa NINHO | Adulto ou infantil', defaultValue: 220 },
    { id: '6', name: 'Aniver. adulto (à vista)', defaultValue: 370 },
    { id: '7', name: 'Pacotes a partir de $ 99', defaultValue: 90 },
    { id: '8', name: 'Vídeo curto até 2min', defaultValue: 200 },
    { id: '9', name: 'Civil "Eterna" (Incluso recepção)', defaultValue: 300 },
    { id: '10', name: 'Casamento linha "Luma"', defaultValue: 600 },
    { id: '11', name: 'Casamento Linha "Eterna"', defaultValue: 1059 },
    { id: '12', name: 'Civil "Luma"', defaultValue: 155 },
    { id: '13', name: 'Filmagens eventos', defaultValue: 750 },
  ]
};

export const APP_NAME = "finOr";
export const APP_SUBTITLE = "by lancaster";