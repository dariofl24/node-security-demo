import bcrypt from 'bcrypt';

const hash1 = await bcrypt.hash('admin123', 10);
const hash2 = await bcrypt.hash('admin123', 10);

console.log(hash1);
console.log(hash2);
console.log('¿Son iguales?', hash1 === hash2);

console.log('hash1 valida:', await bcrypt.compare('admin123', hash1));
console.log('hash2 valida:', await bcrypt.compare('admin123', hash2));
console.log('password incorrecto:', await bcrypt.compare('nope', hash1));

for (const cost of [4, 6, 8, 10, 12, 14, 16]) {
    const start = performance.now();
    let genHash = await bcrypt.hash('admin123', cost);
    console.log(`${genHash} - cost ${cost}:`, Math.round(performance.now() - start), 'ms');
}
