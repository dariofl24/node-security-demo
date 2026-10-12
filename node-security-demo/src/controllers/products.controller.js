import { products } from '../data/products.js';

let nextId = Math.max(0, ...products.map(product => product.id)) + 1;

export function listProducts(req, res) {
    return res.json({
        items: products
    });
}

export function createProduct(req, res) {
    const { name, price } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim() ||
        typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        return res.status(400).json({
            error: 'Name and a finite non-negative numeric price are required'
        });
    }

    const product = {
        id: nextId++,
        name,
        price
    };

    products.push(product);

    return res
        .status(201)
        .json(product);
}

export function deleteProduct(req, res) {
    const productId = Number(req.params.id);

    const index = products.findIndex(
        product => product.id === productId
    );

    if (index === -1) {
        return res.status(404).json({
            error: 'Product not found'
        });
    }

    const [deletedProduct] = products.splice(
        index,
        1
    );

    return res.json({
        deleted: deletedProduct
    });
}