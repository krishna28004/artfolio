export interface Artwork {
    id: string;
    title: string;
    artist: string;
    year: number;
    description: string;
    imageUrl: string;
    price?: number;
    isAvailable: boolean;
}

export const placeholders: Artwork[] = [
    {
        id: 'monolith-01',
        title: 'Monolith',
        artist: 'Aurelius Vance',
        year: 2026,
        description: 'An exploration of tension between organic texture and rigid geometry. Charcoal on spatial void.',
        imageUrl: '/images/artworks/monolith.png',
        price: 12000,
        isAvailable: true,
    },
    {
        id: 'void-01',
        title: 'The Void',
        artist: 'Aurelius Vance',
        year: 2026,
        description: 'A single, heavy geometric concrete shape suspended in an ethereal warm white void.',
        imageUrl: '/images/artworks/void.png',
        price: 8500,
        isAvailable: true,
    },
    {
        id: 'aether-01',
        title: 'Aether',
        artist: 'Aurelius Vance',
        year: 2026,
        description: 'Charcoal-black stone intersecting with raw unbleached linen under harsh directional light.',
        imageUrl: '/images/artworks/aether.png',
        isAvailable: false,
    },
    {
        id: 'monolith-02',
        title: 'Synthesis',
        artist: 'Aurelius Vance',
        year: 2026,
        description: 'A sharp, geometric intersection of dark obsidian and matte white plaster.',
        imageUrl: '/images/artworks/monolith.png',
        price: 15400,
        isAvailable: true,
    },
    {
        id: 'void-02',
        title: 'Obelisk',
        artist: 'Aurelius Vance',
        year: 2026,
        description: 'A thin, dark slate obelisk standing alone in an endless grey void. Brutalist texture.',
        imageUrl: '/images/artworks/void.png',
        price: 9200,
        isAvailable: true,
    },
    {
        id: 'aether-02',
        title: 'Gravitas',
        artist: 'Aurelius Vance',
        year: 2026,
        description: 'A massive, weathered bronze and concrete slab leaning against a matte black wall.',
        imageUrl: '/images/artworks/aether.png',
        isAvailable: false,
    }
];
