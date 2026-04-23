/**
 * Static map configuration shared by InteractiveMap and (future) MapView UIs.
 * Extracted from the original 738-line InteractiveMap.tsx so that other map
 * surfaces can reuse the same regions / store catalog without duplicating data.
 */

export interface RegionDef {
    name: string;
    cities: string[];
    center: [number, number];
    zoom: number;
}

export const REGIONS: RegionDef[] = [
    { name: '沖縄本島', cities: [], center: [26.3344, 127.8056], zoom: 10 },
    {
        name: '那覇・南部',
        cities: [
            '那覇市', '浦添市', '豊見城市', '糸満市', '南城市',
            '八重瀬町', '南風原町', '与那原町', '西原町',
        ],
        center: [26.2124, 127.6809],
        zoom: 11,
    },
    {
        name: '中部',
        cities: [
            '沖縄市', 'うるま市', '宜野湾市', '北谷町', '嘉手納町',
            '読谷村', '北中城村', '中城村',
        ],
        center: [26.3344, 127.8056],
        zoom: 11,
    },
    {
        name: '北部',
        cities: [
            '名護市', '本部町', '今帰仁村', '恩納村', '金武町',
            '宜野座村', '大宜味村', '東村', '国頭村',
        ],
        center: [26.5919, 127.9772],
        zoom: 10,
    },
];

/** Cities/villages outside the main island that we filter out of the map view. */
export const REMOTE_ISLANDS = [
    '宮古島市', '石垣市', '久米島町', '竹富町', '与那国町', '多良間村',
    '伊江村', '伊平屋村', '伊是名村', '渡嘉敷村', '座間味村', '粟国村',
    '渡名喜村', '南大東村', '北大東村',
];

export interface SumahoStore {
    id: string;
    name: string;
    subtitle: string;
    address: string;
    coordinates: [number, number];
    googleMapsUrl: string;
}

export const SUMAHO119_STORES: readonly SumahoStore[] = [
    { id: 'nago', name: '名護店', subtitle: '', address: '沖縄県名護市見取川原4472 イオン名護店 1F', coordinates: [26.5919, 127.9772], googleMapsUrl: 'https://maps.google.com/?q=26.5919,127.9772' },
    { id: 'ishikawa', name: '石川店', subtitle: '', address: '沖縄県うるま市石川2-24-5', coordinates: [26.4319, 127.8308], googleMapsUrl: 'https://maps.google.com/?q=26.4319,127.8308' },
    { id: 'uruma', name: 'うるま店', subtitle: '', address: '沖縄県うるま市江洲507 うるまシティプラザ1F', coordinates: [26.3719, 127.8508], googleMapsUrl: 'https://maps.google.com/?q=26.3719,127.8508' },
    { id: 'awase', name: '泡瀬店', subtitle: '', address: '沖縄県沖縄市泡瀬4-5-7 イオンタウン泡瀬店', coordinates: [26.3344, 127.8508], googleMapsUrl: 'https://maps.google.com/?q=26.3344,127.8508' },
    { id: 'ginowan', name: '宜野湾店', subtitle: '（本社）', address: '沖縄県宜野湾市上原1-6-3', coordinates: [26.2815, 127.7781], googleMapsUrl: 'https://maps.google.com/?q=26.2815,127.7781' },
    { id: 'nishihara', name: '西原店', subtitle: '', address: '沖縄県中頭郡西原町小波津616-3-1F', coordinates: [26.2181, 127.7614], googleMapsUrl: 'https://maps.google.com/?q=26.2181,127.7614' },
    { id: 'toyomi', name: 'とよみ店', subtitle: '', address: '沖縄県豊見城市根差部710 イオンタウンとよみ1F', coordinates: [26.1614, 127.6672], googleMapsUrl: 'https://maps.google.com/?q=26.1614,127.6672' },
    { id: 'itoman', name: '糸満店', subtitle: '', address: '沖縄県糸満市潮平780-5', coordinates: [26.1247, 127.6647], googleMapsUrl: 'https://maps.google.com/?q=26.1247,127.6647' },
];

export interface MapCategoryDef {
    id: string;
    label: string;
    type: '売買' | '賃貸';
}

export const MAP_CATEGORIES: MapCategoryDef[] = [
    { id: 'buy_house', label: '売買戸建', type: '売買' },
    { id: 'buy_mansion', label: '売買マンション', type: '売買' },
    { id: 'buy_land', label: '売買土地', type: '売買' },
    { id: 'rent', label: '賃貸', type: '賃貸' },
];

/** Default center / zoom when no region is selected. */
export const DEFAULT_MAP_CENTER: [number, number] = [26.3344, 127.8056];
export const DEFAULT_MAP_ZOOM = 10;
