const PRODUCTS = [
    {
        id: "remera",
        type: "remera",
        name: "Remera del Jardín",
        description: "Remera oficial Risas y Colores.",
        avatar: "https://example.com/remera.webp",
        active: true,
        variants: [
        { size: "2", price: 14900, stock: 10 },
        { size: "4", price: 14900, stock: 10 },
        { size: "6", price: 15900, stock: 10 },
        { size: "8", price: 15900, stock: 10 },
        { size: "10", price: 16900, stock: 10 },
        ],
    },
    {
        id: "buzo",
        type: "buzo",
        name: "Buzo del Jardín",
        description: "Buzo azul #4a90c2 con logo.",
        avatar: "https://example.com/buzo.webp",
        active: true,
        variants: [
        { size: "2", price: 24900, stock: 10 },
        { size: "4", price: 24900, stock: 10 },
        { size: "6", price: 25900, stock: 10 },
        { size: "8", price: 25900, stock: 10 },
        { size: "10", price: 26900, stock: 10 },
        ],
    },
    {
        id: "pantalon",
        type: "pantalon",
        name: "Pantalón Jogging",
        description: "Pantalón jogging largo azul #4a90c2.",
        avatar: "https://example.com/pantalon.webp",
        active: true,
        variants: [
        { size: "2", price: 19900, stock: 10 },
        { size: "4", price: 19900, stock: 10 },
        { size: "6", price: 20900, stock: 10 },
        { size: "8", price: 20900, stock: 10 },
        { size: "10", price: 21900, stock: 10 },
        ],
    },
    {
        id: "mochila",
        type: "mochila",
        name: "Mochila del Jardín",
        description: "Mochila azul con logo. Talle único.",
        avatar: "https://example.com/mochila.webp",
        active: true,
        variants: [{ size: "U", price: 23900, stock: 10 }],
    },
];

export const list = async (filters) => {
    const { q, type, active } = filters;

    let result = [...PRODUCTS];

    if (q) {
        const needle = q.toLowerCase();
        result = result.filter(
        (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.description.toLowerCase().includes(needle)
        );
    }

    if (type) result = result.filter((p) => p.type === type);

    if (active === "true") result = result.filter((p) => p.active === true);
    if (active === "false") result = result.filter((p) => p.active === false);

    return result;
};

export const getById = async (id) => {
    return PRODUCTS.find((p) => p.id === id) || null;
};
