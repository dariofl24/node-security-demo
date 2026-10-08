# Guía paso a paso — Demo de seguridad de APIs con Node.js, Express y JWT

## Objetivo

En esta guía construiremos una API REST con **Node.js + Express 5** que permita demostrar:

- autenticación con email y password;
- hashing de passwords con `bcrypt`;
- generación de **JSON Web Tokens (JWT)**;
- uso del header `Authorization: Bearer <token>`;
- middleware de autenticación;
- autorización basada en roles;
- diferencia práctica entre `401 Unauthorized` y `403 Forbidden`;
- rutas públicas y protegidas.

El proyecto está pensado como **demo educativa para una clase de aproximadamente 100 minutos**.

> **Importante:** varios elementos de este proyecto están simplificados para fines didácticos. Al final se explica qué cambiar para un sistema de producción.

---

# 1. Requisitos

Se recomienda:

```text
Node.js 24 LTS
npm
Postman o curl
Editor de código (VS Code, WebStorm, etc.)
```

Verificar la versión instalada:

```bash
node --version
npm --version
```

Ejemplo:

```text
v24.x.x
```

---

# 2. Crear el proyecto

Crear un nuevo directorio:

```bash
mkdir node-security-demo
cd node-security-demo
```

Inicializar npm:

```bash
npm init -y
```

Instalar las dependencias:

```bash
npm install express@5 jsonwebtoken bcrypt
```

Las responsabilidades de estas librerías serán:

| Librería | Uso |
|---|---|
| `express` | API HTTP y routing |
| `jsonwebtoken` | Crear y verificar JWT |
| `bcrypt` | Hash y validación de passwords |

> **Nota (verificada en la implementación):** con npm 11 puede aparecer este aviso al instalar:
>
> ```text
> npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
> npm warn allow-scripts   bcrypt@6.0.0 (install: node-gyp-build)
> ```
>
> En la práctica `bcrypt` funcionó sin aprobar el script, porque trae binarios precompilados. Si en alguna máquina falla al cargar el módulo, ejecutar:
>
> ```bash
> npm approve-scripts bcrypt
> npm rebuild bcrypt
> ```

---

# 3. Configurar ES Modules

> **Nota (verificada en la implementación):** `npm init -y` genera por defecto `"type": "commonjs"` y un `name` derivado del directorio. Con el directorio `node-security-demo`, npm 11 quita el prefijo `node-` y genera `"name": "security-demo"`. Hay que corregir ambos campos a mano, como se indica abajo.

Abrir `package.json`, cambiar `"type": "commonjs"` por `"type": "module"` y, si hace falta, ajustar el `name` a `node-security-demo`:

```json
{
  "type": "module"
}
```

Después agregar los scripts:

```json
{
  "scripts": {
    "dev": "node --env-file=.env --watch src/server.js",
    "start": "node --env-file=.env src/server.js"
  }
}
```

El `package.json` será parecido a:

```json
{
  "name": "node-security-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --env-file=.env --watch src/server.js",
    "start": "node --env-file=.env src/server.js"
  },
  "dependencies": {
    "bcrypt": "^6.0.0",
    "express": "^5.0.0",
    "jsonwebtoken": "^9.0.0"
  }
}
```

Si se cambió el `name` después de instalar las dependencias, actualizar también `package-lock.json`:

```bash
npm install --package-lock-only --ignore-scripts
```

Editar `package.json` no actualiza automáticamente el nombre del proyecto en el archivo de bloqueo. Esta diferencia no impide arrancar la demo, pero conviene mantener ambos archivos coherentes.

> No es necesario instalar `nodemon` para este proyecto. Las versiones modernas de Node.js soportan `node --watch`.

Tampoco necesitamos `dotenv`: Node.js puede leer directamente un archivo `.env` mediante `--env-file`.

---

# 4. Crear `.gitignore`

Crear:

```text
.gitignore
```

Contenido:

```gitignore
node_modules/
.env
.DS_Store
```

Es importante que `.env` **no se agregue al repositorio**.

---

# 5. Crear las variables de entorno

Crear:

```text
.env
```

Contenido:

```env
PORT=3000
JWT_SECRET=change-this-demo-secret-to-a-long-random-value
```

Para una demo local esto es suficiente.

## ¿Qué es `JWT_SECRET` y por qué importa tanto?

Con HS256 el servidor usa **la misma clave** para firmar los tokens (`jwt.sign`) y para verificarlos (`jwt.verify`). Esa clave es `JWT_SECRET`.

```text
quien conoce JWT_SECRET  =  puede crear tokens válidos
```

Si el secret se filtra, un atacante puede fabricar un token con cualquier `sub` y `role: "admin"`, firmarlo correctamente, y el servidor lo aceptará: **no hay forma de distinguirlo de un token legítimo**. Por eso:

- `.env` está en `.gitignore` (sección 4);
- nunca debe aparecer en el código, en logs ni en el cliente;
- debe ser largo y aleatorio. Un secret corto o adivinable (`secret`, `123456`) permite ataques de fuerza bruta **offline**: el atacante toma un token y prueba secrets hasta que la firma coincide, sin tocar nunca el servidor.

### Cómo generar un secret real

```bash
openssl rand -base64 48
```

Genera 64 caracteres aleatorios. Alternativa sin OpenSSL:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

### ¿Qué pasa si se cambia o se rota el secret?

Todos los tokens emitidos con el secret anterior dejan de verificar y los usuarios reciben `401`. Es el mecanismo de emergencia más contundente si se sospecha una filtración: invalida **todas** las sesiones a la vez. Por eso los sistemas grandes usan identificadores de clave (`kid`) para tener varias claves activas durante una rotación.

En producción el secret debería almacenarse en un sistema de gestión de secretos, por ejemplo:

- Kubernetes Secrets;
- AWS Secrets Manager;
- Google Secret Manager;
- Azure Key Vault;
- HashiCorp Vault.

---

# 6. Crear la estructura del proyecto

Crear la siguiente estructura:

```text
node-security-demo/
│
├── .env
├── .gitignore
├── package.json
│
├── src/
│   ├── app.js
│   ├── server.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── profile.controller.js
│   │   └── products.controller.js
│   │
│   ├── data/
│   │   ├── products.js
│   │   └── users.js
│   │
│   ├── middleware/
│   │   ├── requireAuth.js
│   │   └── requireRole.js
│   │
│   └── routes/
│       ├── auth.routes.js
│       ├── profile.routes.js
│       └── products.routes.js
```

Puede crearse rápidamente con:

```bash
mkdir -p src/controllers src/data src/middleware src/routes

touch src/app.js
touch src/server.js

touch src/controllers/auth.controller.js
touch src/controllers/profile.controller.js
touch src/controllers/products.controller.js

touch src/data/users.js
touch src/data/products.js

touch src/middleware/requireAuth.js
touch src/middleware/requireRole.js

touch src/routes/auth.routes.js
touch src/routes/profile.routes.js
touch src/routes/products.routes.js
```

---

# 7. Crear los usuarios de demostración

Crear:

```text
src/data/users.js
```

Contenido:

```javascript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/*
 * DEMO ONLY
 *
 * Las credenciales conocidas se mantienen aquí únicamente para que
 * los estudiantes puedan probar la aplicación.
 *
 * Los objetos exportados NO contienen el password en texto plano.
 * La aplicación genera un hash bcrypt durante la inicialización.
 *
 * En producción:
 * - el usuario vendría de una base de datos;
 * - el password ya estaría almacenado como hash;
 * - nunca generaríamos todos los hashes al arrancar el servidor.
 */

const demoAccounts = [
  {
    id: 'user-1',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 'user-2',
    email: 'student@example.com',
    password: 'student123',
    role: 'user'
  }
];

export const users = await Promise.all(
  demoAccounts.map(async ({ password, ...user }) => {
    const passwordHash = await bcrypt.hash(
      password,
      SALT_ROUNDS
    );

    return {
      ...user,
      passwordHash
    };
  })
);
```

Este código nos permite usar dos usuarios:

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `admin123` | `admin` |
| `student@example.com` | `student123` | `user` |

## Punto de interés

El password:

```text
admin123
```

no queda almacenado dentro del objeto de usuario usado durante la ejecución.

En su lugar tenemos algo parecido a:

```text
$2b$10$...
```

Ese valor es el **hash**.

## ¿Qué es bcrypt?

`bcrypt` es una función de hashing diseñada específicamente para **guardar passwords**. Convierte un password en una cadena irreversible, el *hash*.

Un hash **no es cifrado**:

```text
Cifrado   →  se puede revertir con la llave
Hash      →  no tiene vuelta atrás; solo se puede comprobar
             si un password candidato produce el mismo resultado
```

```text
"admin123"  ──bcrypt──►  $2b$10$SmICZ5rDtQhHPJA09eFbIeKzVFPqqbip5Jv5YTwkdDWTFUBhcb5rS
                         (no se puede volver a "admin123")
```

### ¿Por qué no basta SHA-256 o MD5?

Esos algoritmos están diseñados para ser **rápidos**. Un atacante que robe una base de datos puede probar miles de millones de passwords por segundo con una GPU. bcrypt es **lento a propósito**, y ese costo es configurable.

| Problema | Cómo lo resuelve bcrypt |
|---|---|
| Fuerza bruta rápida | Es deliberadamente lento (*cost factor*) |
| Rainbow tables (hashes precalculados) | Usa un *salt* aleatorio por cada password |
| Dos usuarios con el mismo password tendrían el mismo hash | El salt hace que cada hash sea distinto |

### Anatomía de un hash bcrypt

```text
$2b$10$SmICZ5rDtQhHPJA09eFbIe KzVFPqqbip5Jv5YTwkdDWTFUBhcb5rS
 │  │  └────── salt ────────┘ └────────── hash ───────────────┘
 │  └── cost factor (10)
 └── versión del algoritmo
```

| Parte | Descripción |
|---|---|
| `2b` | Versión del algoritmo |
| `10` | Cost factor. Es el valor `SALT_ROUNDS` de `users.js`. Se ejecutan `2^10 = 1024` iteraciones; cada +1 **duplica** el tiempo |
| Salt | 22 caracteres aleatorios generados automáticamente |
| Hash | 31 caracteres con el resultado |

El hash completo mide siempre **60 caracteres**. Como el salt y el cost factor **viajan dentro del propio hash**, no hace falta guardarlos por separado: el único campo que se almacena es `passwordHash`.

### Las dos operaciones que usa la guía

**1. `bcrypt.hash(password, SALT_ROUNDS)`** (sección 7)

```javascript
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
```

Genera un salt aleatorio, aplica el algoritmo y devuelve el hash completo. Si se ejecuta dos veces con el mismo password se obtienen **dos hashes distintos**, y ambos son válidos.

**2. `bcrypt.compare(password, passwordHash)`** (sección 9)

```javascript
const passwordIsValid = await bcrypt.compare(password, user.passwordHash);
```

Lee el salt y el cost del hash guardado, recalcula el hash del password recibido y compara los resultados. Devuelve `true` o `false`. **Nunca "descifra"** el hash.

### Dónde interviene en el login

```text
password recibido ("student123")
        │
        ▼
bcrypt.compare( "student123", "$2b$10$..." )
        │
        ├── false ─► 401 Invalid credentials
        │
        └── true  ─► jwt.sign(...) ─► accessToken
```

Después de la comparación el password en texto plano no se vuelve a usar: no se guarda en el objeto de usuario ni se coloca en el JWT.

### ¿Por qué las funciones son `async`?

bcrypt es costoso a propósito. Las versiones asíncronas se ejecutan fuera del hilo principal de Node.js, así que mientras se calcula un hash el servidor sigue atendiendo otras peticiones. La versión síncrona (`hashSync`, `compareSync`) **bloquearía todo el servidor**. Por eso usamos `await`.

### Ejercicio de exploración (5 minutos)

Crear un archivo temporal `bcrypt-demo.mjs` en la raíz del proyecto:

```javascript
import bcrypt from 'bcrypt';

const hash1 = await bcrypt.hash('admin123', 10);
const hash2 = await bcrypt.hash('admin123', 10);

console.log(hash1);
console.log(hash2);
console.log('¿Son iguales?', hash1 === hash2);

console.log('hash1 valida:', await bcrypt.compare('admin123', hash1));
console.log('hash2 valida:', await bcrypt.compare('admin123', hash2));
console.log('password incorrecto:', await bcrypt.compare('nope', hash1));

for (const cost of [10, 12]) {
  const start = performance.now();
  await bcrypt.hash('admin123', cost);
  console.log(`cost ${cost}:`, Math.round(performance.now() - start), 'ms');
}
```

Ejecutar:

```bash
node bcrypt-demo.mjs
```

Resultado de ejemplo (los hashes y tiempos variarán):

```text
$2b$10$SmICZ5rDtQhHPJA09eFbIeKzVFPqqbip5Jv5YTwkdDWTFUBhcb5rS
$2b$10$ZtD54RqIBIRJ7Lo09fpKneeoZwc1nfuV2qh2K/sd4Qn7J2e5.H2GW
¿Son iguales? false
hash1 valida: true
hash2 valida: true
password incorrecto: false
cost 10: 48 ms
cost 12: 193 ms
```

Preguntas para los estudiantes:

1. ¿Por qué dos hashes del mismo password son distintos y aun así ambos validan?
2. ¿Qué pasa con el tiempo cuando el cost sube de 10 a 12?
3. ¿Qué ventaja tiene esto para quien defiende frente a un atacante con una base de datos robada?

Borrar el archivo al terminar.

### Detalles importantes (más allá de la demo)

1. **Límite de 72 bytes:** bcrypt solo considera los primeros 72 bytes del password; lo que sigue se ignora. Comprobado: un password de 72 caracteres y otro de 75 con los mismos 72 iniciales validan contra el mismo hash. En producción se limita la longitud máxima del password o se usa otro algoritmo.
2. **Elección del cost:** 10 es un mínimo razonable. En producción se suele subir (12 o más), calibrándolo para que un hash tarde entre ~100 y ~300 ms en el hardware del servidor. En este equipo, cost 12 tardó ~190 ms.
3. **Alternativas modernas:** Argon2id es el estándar recomendado actualmente (OWASP); scrypt también se usa. bcrypt sigue siendo aceptable y muy extendido.
4. **Posible fuga por tiempo de respuesta:** el `login` devuelve el mismo mensaje `Invalid credentials` tanto si el usuario no existe como si el password es incorrecto. Sin embargo, cuando el usuario no existe el código responde **sin ejecutar** `bcrypt.compare` (~50 ms menos en este equipo), por lo que un atacante podría medir la diferencia para descubrir qué emails existen. Una mitigación habitual es ejecutar siempre un `compare` contra un hash falso cuando el usuario no existe. Es un buen punto de discusión: un detalle de implementación puede anular una medida de seguridad. La demo no lo corrige para mantener el código simple.

---

# 8. Crear los productos de demostración

Crear:

```text
src/data/products.js
```

Contenido:

```javascript
export const products = [
  {
    id: 1,
    name: 'Mechanical Keyboard',
    price: 120
  },
  {
    id: 2,
    name: 'Wireless Mouse',
    price: 50
  }
];
```

Estos datos se mantienen en memoria para no mezclar todavía:

```text
Authentication
+
Database persistence
```

El objetivo de esta sesión es concentrarse en seguridad.

---

# 9. Crear el controller de autenticación

Crear:

```text
src/controllers/auth.controller.js
```

Contenido:

```javascript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { users } from '../data/users.js';

const JWT_ISSUER = 'node-security-demo';
const JWT_AUDIENCE = 'node-security-demo-client';

const ACCESS_TOKEN_TTL_SECONDS = 900;

export async function login(req, res) {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: 'Email and password must be non-empty strings'
    });
  }

  const user = users.find(
    candidate => candidate.email === email
  );

  /*
   * Usamos el mismo mensaje tanto si el usuario no existe como si
   * el password es incorrecto.
   *
   * Esto evita revelar innecesariamente si una cuenta existe.
   */
  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  const passwordIsValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordIsValid) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  const accessToken = jwt.sign(
    {
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256'
    }
  );

  return res.json({
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });
}
```

En Express 5, `req.body` puede ser `undefined` si la petición no tiene cuerpo o no se envía con `Content-Type: application/json`. Usar `req.body ?? {}` permite devolver `400` en lugar de lanzar un error al desestructurar. Además, comprobar los tipos evita enviar un password numérico u objeto a `bcrypt.compare`.

No se aplica `trim()` al password: los espacios pueden formar parte de la contraseña. La constante `ACCESS_TOKEN_TTL_SECONDS` expresa la duración en segundos y se usa tanto al firmar el JWT como en la respuesta del login.

---

# 10. Entender lo que hace el login

El flujo es:

```text
Client
   │
   │ POST /auth/login
   │ email + password
   ▼
Auth Controller
   │
   ├── buscar usuario
   │
   ├── bcrypt.compare()
   │
   └── jwt.sign()
           │
           ▼
      Access Token
           │
           ▼
        Client
```

Si las credenciales son correctas:

```javascript
jwt.sign(...)
```

crea un token firmado.

El payload contiene:

```json
{
  "role": "admin"
}
```

Además `jsonwebtoken` agrega los claims correspondientes a:

```text
sub = user ID
iat = issued at
exp = expiration
iss = issuer
aud = audience
```

---

# 11. Crear la ruta de login

Crear:

```text
src/routes/auth.routes.js
```

Contenido:

```javascript
import { Router } from 'express';

import { login } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', login);

export default router;
```

La URL final será:

```text
POST /auth/login
```

---

# 12. Crear el middleware de autenticación

Crear:

```text
src/middleware/requireAuth.js
```

Contenido:

```javascript
import jwt from 'jsonwebtoken';

const JWT_ISSUER = 'node-security-demo';
const JWT_AUDIENCE = 'node-security-demo-client';

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.set('WWW-Authenticate', 'Bearer');

    return res.status(401).json({
      error: 'Authorization header required'
    });
  }

  const match = /^Bearer +([^\s]+)$/i.exec(authorization);

  if (!match) {
    res.set('WWW-Authenticate', 'Bearer');

    return res.status(401).json({
      error: 'Invalid authorization header'
    });
  }

  const token = match[1];

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }
    );

    if (!payload || typeof payload !== 'object' ||
        typeof payload.sub !== 'string' || !payload.sub ||
        !['user', 'admin'].includes(payload.role) ||
        !Number.isInteger(payload.exp)) {
      throw new Error('Required token claims are missing or invalid');
    }

    req.user = {
      id: payload.sub,
      role: payload.role
    };

    next();
  } catch {
    res.set('WWW-Authenticate', 'Bearer');

    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
}
```

---

# 13. ¿Qué hace `requireAuth`?

Recibimos:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

El middleware separa:

```text
scheme = Bearer

token = eyJhbGciOiJIUzI1NiIs...
```

Después:

```javascript
jwt.verify(...)
```

comprueba:

```text
firma
algoritmo
issuer
audience
expiración
```

Si todo es correcto:

```javascript
req.user = {
  id: payload.sub,
  role: payload.role
};
```

Por lo tanto, los siguientes middlewares y controllers pueden saber quién hizo la petición.

> **Nota:** la expresión regular valida el header completo. Acepta uno o varios espacios entre `Bearer` y el token y no distingue mayúsculas de minúsculas en el esquema. Rechaza campos adicionales, como `Bearer TOKEN extra`, con `401 Invalid authorization header`. La validación del formato no sustituye la verificación de la firma.

## ¿Por qué `jwt.verify` recibe tantas opciones?

```javascript
jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE
});
```

Cada opción cierra una vía de ataque distinta. Los resultados siguientes se obtuvieron ejecutando el código de la demo:

| Token recibido | Resultado de `verify` |
|---|---|
| Token válido | acepta |
| Payload modificado a `role: admin`, misma firma | `invalid signature` |
| Firmado con otro secret | `invalid signature` |
| Header con `alg: none` y sin firma | `jwt signature is required` |
| Token RS256 cuando solo se acepta HS256 | `invalid algorithm` |
| Emitido para otra audiencia (`aud`) | `jwt audience invalid` |
| Emitido por otro emisor (`iss`) | `jwt issuer invalid` |
| Pasada la fecha `exp` | `jwt expired` |

- **`algorithms: ['HS256']`:** el servidor decide qué algoritmo acepta; **nunca** el token. El header del JWT lo escribe el cliente y por lo tanto no es confiable. Históricamente varias librerías aceptaban `alg: none` (token sin firma) o permitían confundir un algoritmo asimétrico con uno simétrico. Las versiones actuales de `jsonwebtoken` ya rechazan `none` por defecto, pero fijar la lista sigue siendo una defensa adicional y una buena práctica.
- **`issuer` y `audience`:** evitan que un token legítimo emitido para **otro** servicio o por **otro** emisor sea aceptado aquí aunque la firma sea válida (por ejemplo, si dos APIs comparten por error el mismo secret).

## Verificar un claim no equivale a exigir su presencia

`jwt.verify` comprueba la expiración cuando el token contiene `exp`, pero no exige por sí solo que ese claim esté presente. Tampoco garantiza que existan `sub` y `role` con los tipos que necesita la aplicación.

Por eso, después de verificar la firma, el middleware exige:

- `sub`: una cadena no vacía que identifica al usuario;
- `role`: uno de los roles permitidos, `user` o `admin`;
- `exp`: un número entero que representa la expiración en segundos.

Un token correctamente firmado pero sin esos claims recibe `401 Invalid or expired token`. La falta de claims no permite falsificar una firma; esta comprobación asegura que los tokens aceptados también cumplen el contrato de identidad de la demo.

## Cómo funciona el pipeline de middlewares

Un middleware de Express es una función `(req, res, next)`. Express las ejecuta **en el orden en que están declaradas**:

```javascript
router.delete('/:id', requireAuth, requireRole('admin'), deleteProduct);
```

```text
requireAuth ──next()──► requireRole ──next()──► deleteProduct
     │                       │
     └─ res.status(401)      └─ res.status(403)
        (corta aquí)            (corta aquí)
```

- **`next()`** pasa el control al siguiente middleware.
- **Responder (`res.json`, `res.status(...)`)** termina la respuesta HTTP, pero no detiene la ejecución de JavaScript. Los siguientes handlers no se ejecutan si no se llama a `next()`. Usamos `return res.status(...).json(...)` para salir del middleware inmediatamente.
- **El orden importa.** `requireRole` lee `req.user`, que solo existe si `requireAuth` corrió antes. Por eso `requireRole` también comprueba `if (!req.user)`: si alguien lo coloca antes por error, falla con `401` en lugar de dejar pasar la petición.

### Por qué los `return` son indispensables

Fíjate en que `requireAuth` siempre escribe `return res.status(401)...`. Sin el `return`, el código **sigue ejecutándose** después de responder.

Comprobado en la implementación: con un middleware que responde `401` pero **olvida el `return`** y llama a `next()`, el controller **sí se ejecuta** (la operación protegida se realiza) y Express lanza:

```text
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
```

El cliente recibe `401`, pero la lógica de negocio ya corrió. Es un error sutil y peligroso: en un `DELETE` el producto se borraría aunque el usuario viera un rechazo. Con el `return`, el handler no se ejecuta.

### Por qué `requireRole('admin')` es una función que devuelve otra

```javascript
export function requireRole(requiredRole) {
  return function roleMiddleware(req, res, next) { ... };
}
```

Express espera una función `(req, res, next)`, pero necesitamos **parametrizarla** con el rol. La solución es una *closure*: la función exterior recibe `requiredRole` y la función interior lo "recuerda". Así se crean middlewares distintos con la misma lógica:

```javascript
requireRole('admin')    // exige admin
requireRole('manager')  // exige manager
```

El flujo de la sección 39 resume cómo se encadenan.

El flujo de `requireAuth` es:

```text
HTTP Request
      │
      ▼
Authorization Header
      │
      ▼
requireAuth()
      │
      ├── missing token ─────► 401
      │
      ├── invalid token ─────► 401
      │
      ├── expired token ─────► 401
      │
      └── valid token
              │
              ▼
           req.user
              │
              ▼
            next()
```

---

# 14. Crear el middleware de roles

Crear:

```text
src/middleware/requireRole.js
```

Contenido:

```javascript
export function requireRole(requiredRole) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    next();
  };
}
```

Este middleware recibe el role requerido:

```javascript
requireRole('admin')
```

y devuelve otro middleware.

Esta técnica es muy común en Express.

---

# 15. 401 vs 403

Esta distinción es importante.

## 401 Unauthorized

Significa que la aplicación **no tiene una identidad autenticada válida** para esa petición.

Ejemplos:

```text
No existe token
Token inválido
Token expirado
Firma incorrecta
```

Respuesta:

```http
HTTP/1.1 401 Unauthorized
```

## 403 Forbidden

La identidad sí es conocida:

```text
user = user-2
role = user
```

pero intenta realizar una operación para la que no tiene permisos:

```text
DELETE /api/products/1
```

cuando se necesita:

```text
role = admin
```

Respuesta:

```http
HTTP/1.1 403 Forbidden
```

Una forma sencilla de recordarlo:

```text
401
"No sé quién eres de forma válida."

403
"Sé quién eres, pero no puedes hacer esto."
```

---

# 16. Crear el controller del profile

Crear:

```text
src/controllers/profile.controller.js
```

Contenido:

```javascript
export function getProfile(req, res) {
  return res.json({
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
}
```

---

# 17. Crear la ruta protegida del profile

Crear:

```text
src/routes/profile.routes.js
```

Contenido:

```javascript
import { Router } from 'express';

import { getProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  getProfile
);

export default router;
```

La URL será:

```text
GET /api/profile
```

El pipeline es:

```text
Request
   │
   ▼
requireAuth
   │
   ▼
getProfile
```

---

# 18. Crear el controller de productos

Crear:

```text
src/controllers/products.controller.js
```

Contenido:

```javascript
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
```

---

# 19. Crear las rutas de productos

Crear:

```text
src/routes/products.routes.js
```

Contenido:

```javascript
import { Router } from 'express';

import {
  createProduct,
  deleteProduct,
  listProducts
} from '../controllers/products.controller.js';

import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

/*
 * Público.
 */
router.get(
  '/',
  listProducts
);

/*
 * Solamente admin.
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  createProduct
);

/*
 * Solamente admin.
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  deleteProduct
);

export default router;
```

> **Identificadores únicos durante la ejecución:** `createProduct` usa un contador independiente, inicializado a partir del mayor id existente. Eliminar un producto no reduce ese contador. Por ejemplo, tras crear el producto 3 y eliminar el 1, el siguiente producto recibe el id 4. Usar `products.length + 1` produciría un id 3 repetido.
>
> Los productos y el contador se reinician al arrancar de nuevo la aplicación, porque esta demo conserva los datos en memoria. En producción el id lo generaría la base de datos.

Las reglas quedan:

| Endpoint | Seguridad |
|---|---|
| `POST /auth/login` | Público |
| `GET /api/products` | Público |
| `GET /api/profile` | Usuario autenticado |
| `POST /api/products` | Solo `admin` |
| `DELETE /api/products/:id` | Solo `admin` |

---

# 20. Crear la aplicación Express

Crear:

```text
src/app.js
```

Contenido:

```javascript
import express from 'express';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/products.routes.js';
import profileRoutes from './routes/profile.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok'
    });
  });

  app.use(
    '/auth',
    authRoutes
  );

  app.use(
    '/api/profile',
    profileRoutes
  );

  app.use(
    '/api/products',
    productRoutes
  );

  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found'
    });
  });

  // Los errores se gestionan después de las rutas y del handler de 404.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    const status = Number.isInteger(err.status) &&
      err.status >= 400 && err.status < 600 ? err.status : 500;

    return res.status(status).json({
      error: err.type === 'entity.parse.failed'
        ? 'Invalid JSON body'
        : status >= 500 ? 'Internal server error' : 'Invalid request'
    });
  });

  return app;
}
```

El middleware de errores tiene cuatro parámetros: `(err, req, res, next)`. Debe declararse después de las rutas y antes de devolver `app`. Así, un JSON mal formado recibe `400` con un cuerpo JSON, y un error inesperado recibe `500` sin exponer su traza al cliente.

Este middleware da formato a los errores; las validaciones de los controllers siguen siendo necesarias para que una entrada inválida produzca `400` en lugar de `500`.

---

# 21. Crear el servidor

Crear:

```text
src/server.js
```

Contenido:

```javascript
import { createApp } from './app.js';

const PORT = Number(
  process.env.PORT ?? 3000
);

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required'
  );
}

const app = createApp();

app.listen(PORT, () => {
  console.log(
    `API running at http://localhost:${PORT}`
  );
});
```

---

# 22. Ejecutar la aplicación

Ejecutar:

```bash
npm run dev
```

Deberíamos ver:

```text
API running at http://localhost:3000
```

Como usamos:

```text
node --watch
```

el proceso se reiniciará automáticamente cuando cambie un archivo importado por la aplicación.

---

# 23. Primera prueba: health check

Ejecutar:

```bash
curl http://localhost:3000/health
```

Respuesta:

```json
{
  "status": "ok"
}
```

Esto confirma que:

```text
Node
+
Express
+
routing
```

funcionan correctamente antes de empezar a probar la seguridad.

---

# 24. Probar la ruta pública

Ejecutar:

```bash
curl http://localhost:3000/api/products
```

Respuesta esperada:

```json
{
  "items": [
    {
      "id": 1,
      "name": "Mechanical Keyboard",
      "price": 120
    },
    {
      "id": 2,
      "name": "Wireless Mouse",
      "price": 50
    }
  ]
}
```

No necesitamos token.

---

# 25. Intentar acceder al profile sin token

Ejecutar:

```bash
curl -i http://localhost:3000/api/profile
```

Respuesta esperada:

```text
HTTP/1.1 401 Unauthorized
```

Body:

```json
{
  "error": "Authorization header required"
}
```

Punto docente:

```text
¿Por qué 401 y no 403?
```

Porque todavía no tenemos una identidad autenticada válida.

---

# 26. Realizar login como usuario normal

Ejecutar:

```bash
curl -X POST \
  http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "student123"
  }'
```

Respuesta:

```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

Copiar el valor de:

```text
accessToken
```

---

# 27. Inspeccionar el JWT

Un JWT tiene tres partes:

```text
HEADER.PAYLOAD.SIGNATURE
```

Por ejemplo:

```text
xxxxx.yyyyy.zzzzz
```

Conceptualmente:

```text
┌───────────────┐
│ Header        │
│ alg = HS256   │
└───────────────┘
        .
┌───────────────┐
│ Payload       │
│ sub           │
│ role          │
│ iat           │
│ exp           │
│ iss           │
│ aud           │
└───────────────┘
        .
┌───────────────┐
│ Signature     │
└───────────────┘
```

## Punto docente importante

El payload **no está cifrado**.

Por eso no debemos colocar información sensible como:

```json
{
  "password": "secret"
}
```

dentro del token.

## Decodificar un JWT paso a paso

Un JWT real (generado por la demo) se ve así:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoidXNlciIsImlhdCI6MTc5MTI1ODkxMCwiZXhwIjoxNzkxMjU5ODEwLCJhdWQiOiJub2RlLXNlY3VyaXR5LWRlbW8tY2xpZW50IiwiaXNzIjoibm9kZS1zZWN1cml0eS1kZW1vIiwic3ViIjoidXNlci0yIn0.ORgzCzjP3_LLQolNUwu7IWRzpzoh0Ar31QMw4Ak_gyE
```

Son tres partes separadas por puntos. Las dos primeras son **JSON codificado en Base64URL**. Base64URL es solo una forma de escribir bytes con caracteres seguros para URLs; **cualquiera puede decodificarlo, no se necesita ninguna clave**.

### Parte 1: header

```bash
echo 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' | base64 -d
```

```json
{ "alg": "HS256", "typ": "JWT" }
```

Indica el algoritmo de firma y el tipo de token.

### Parte 2: payload

Con el token de la demo, decodificar la segunda parte (ver la nota de abajo sobre por qué se usa Node.js):

```bash
node -e "console.log(JSON.parse(Buffer.from('TU_PAYLOAD','base64url')))"
```

```json
{
  "role": "user",
  "iat": 1791258910,
  "exp": 1791259810,
  "aud": "node-security-demo-client",
  "iss": "node-security-demo",
  "sub": "user-2"
}
```

> **Nota (verificada en la implementación):** Base64URL omite los `=` finales de relleno. En macOS, `base64 -d` **no avisa** cuando falta el relleno: devuelve la salida **truncada** y termina con código 0. Con el payload de arriba falta la llave final: `..."sub":"user-2` sin el `}`. No es un error del token. Para decodificar de forma fiable usar Node.js, que sí entiende Base64URL:
>
> ```bash
> node -e "console.log(JSON.parse(Buffer.from('PAYLOAD','base64url')))"
> ```
>
> o pegar el token en https://jwt.io. **Nunca pegues tokens de un sistema real en sitios externos**; para la demo no hay problema.

Esto demuestra el punto clave: **el payload es legible por cualquiera que obtenga el token**. Nunca debe contener passwords ni datos sensibles.

### Parte 3: firma

La firma **no es información**: es una huella que garantiza que header y payload no fueron alterados. Con HS256 se calcula así:

```text
firma = HMAC-SHA256( base64url(header) + "." + base64url(payload), JWT_SECRET )
```

Se puede reproducir con Node.js. Comprobado en la implementación: el resultado coincide exactamente con la firma generada por `jsonwebtoken`.

```javascript
import crypto from 'node:crypto';

const token = 'TU_TOKEN'; // Reemplazar por el accessToken del login.
const [header, payload, signature] = token.split('.');

const mine = crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(`${header}.${payload}`)
  .digest('base64url');

console.log(mine === signature); // true
```

Guardar el código anterior como `jwt-signature-demo.mjs` en la raíz del proyecto. Reemplazar `TU_TOKEN` por un token generado por esta demo y ejecutar:

```bash
node --env-file=.env jwt-signature-demo.mjs
```

Usar el mismo `JWT_SECRET` con el que se emitió el token. El resultado debe ser `true`. Borrar el archivo temporal al terminar.

### Qué pasa si alguien modifica el token

Un atacante puede cambiar el payload a `"role": "admin"`, pero **no puede recalcular la firma** sin conocer `JWT_SECRET`:

```text
header.payload_MODIFICADO.firma_ORIGINAL
                │
                ▼
servidor recalcula HMAC(header + payload_MODIFICADO, secret)
                │
                ▼
no coincide con la firma recibida ──► 401 (invalid signature)
```

Resumen de lo que garantiza y no garantiza un JWT firmado:

| Propiedad | ¿La da la firma? |
|---|---|
| Integridad (el contenido no fue alterado) | Sí |
| Autenticidad (lo emitió quien posee el secret) | Sí |
| Confidencialidad (nadie puede leerlo) | **No** |

## Los claims del payload

Un *claim* es un dato dentro del payload. Algunos son estándar (RFC 7519) y otros son propios de la aplicación.

| Claim | Nombre | Para qué sirve | Quién lo agrega |
|---|---|---|---|
| `sub` | Subject | Identifica **de quién** es el token. Aquí, el id del usuario (`user-2`) | `subject: user.id` |
| `iat` | Issued At | Momento en que se emitió (segundos desde 1970) | `jsonwebtoken` automáticamente |
| `exp` | Expiration | Momento a partir del cual deja de ser válido | `expiresIn: ACCESS_TOKEN_TTL_SECONDS` |
| `iss` | Issuer | **Quién** emitió el token | `issuer: JWT_ISSUER` |
| `aud` | Audience | **Para quién** está destinado el token | `audience: JWT_AUDIENCE` |
| `role` | (propio) | Rol del usuario para autorizar | `{ role: user.role }` |

Detalles que conviene explicar:

- **`sub` es el id y no el email.** Un id es estable; un email puede cambiar o reutilizarse. Además el servidor lo usa como `req.user.id`, que es la fuente de verdad sobre quién hace la petición.
- **`exp` e `iat` están en segundos**, no en milisegundos. `exp - iat = 900` es exactamente los 15 minutos (`expiresIn: 900` en la respuesta del login).
- **`iss` y `aud` previenen la reutilización entre sistemas.** Imaginemos dos APIs que, por error, comparten el mismo secret. Sin `aud`, un token emitido para la API A se aceptaría en la API B. Con `aud`, la API B lo rechaza (`jwt audience invalid`).
- **`role` dentro del token es práctico pero tiene un costo:** el rol queda "congelado" hasta que el token expira. Si a un usuario se le quita el rol de admin, su token actual **seguirá teniendo `role: admin` hasta que caduque** (hasta 15 minutos en esta demo). Esa es una de las razones por las que los access tokens duran poco.

---

# 28. Acceder al profile con token

Usar:

```bash
curl \
  http://localhost:3000/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Reemplazar:

```text
YOUR_TOKEN
```

por el token real.

Respuesta:

```json
{
  "user": {
    "id": "user-2",
    "role": "user"
  }
}
```

El cliente **no envió explícitamente**:

```text
user-2
```

en la petición.

El servidor lo obtuvo del claim:

```text
sub
```

después de verificar el JWT.

---

# 29. Probar autorización con un usuario sin permisos

El usuario:

```text
student@example.com
```

tiene:

```text
role = user
```

Intentar crear un producto:

```bash
curl -i \
  -X POST \
  http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "USB-C Hub",
    "price": 35
  }'
```

Respuesta esperada:

```text
HTTP/1.1 403 Forbidden
```

Body:

```json
{
  "error": "Forbidden"
}
```

Esto demuestra:

```text
Authentication
      ✓

Authorization
      ✗
```

---

# 30. Realizar login como admin

Ejecutar:

```bash
curl -X POST \
  http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

Copiar el nuevo:

```text
accessToken
```

---

# 31. Crear un producto como admin

Ejecutar:

```bash
curl \
  -X POST \
  http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "USB-C Hub",
    "price": 35
  }'
```

Respuesta esperada:

```json
{
  "id": 3,
  "name": "USB-C Hub",
  "price": 35
}
```

Status:

```text
201 Created
```

---

# 32. Eliminar un producto como admin

Ejecutar:

```bash
curl \
  -X DELETE \
  http://localhost:3000/api/products/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Respuesta:

```json
{
  "deleted": {
    "id": 1,
    "name": "Mechanical Keyboard",
    "price": 120
  }
}
```

---

# 33. Probar un token inválido

Ejecutar:

```bash
curl -i \
  http://localhost:3000/api/profile \
  -H "Authorization: Bearer this-is-not-a-valid-token"
```

Respuesta:

```text
HTTP/1.1 401 Unauthorized
```

```json
{
  "error": "Invalid or expired token"
}
```

---

# 34. Probar un token manipulado

Tomar un JWT válido:

```text
aaa.bbb.ccc
```

Modificar manualmente algún carácter:

```text
aaa.bbx.ccc
```

Usarlo:

```bash
curl -i \
  http://localhost:3000/api/profile \
  -H "Authorization: Bearer MODIFIED_TOKEN"
```

La firma ya no coincide.

Respuesta esperada:

```text
401 Unauthorized
```

Esto permite explicar qué protege realmente la firma:

```text
El servidor puede detectar que el contenido fue modificado.
```

---

# 35. Probar expiración

En `src/controllers/auth.controller.js` usamos:

```javascript
const ACCESS_TOKEN_TTL_SECONDS = 900;
```

Esto representa 15 minutos. Para hacer la demostración en clase más rápida, cambiar temporalmente esa constante a:

```javascript
const ACCESS_TOKEN_TTL_SECONDS = 10;
```

La misma constante se usa en las opciones de `jwt.sign` y en el campo `expiresIn` de la respuesta. Así, ambos indican una duración de 10 segundos.

Esperar a que `npm run dev` reinicie el servidor. Si se ejecutó con `npm start`, detenerlo y volver a iniciarlo. Realizar un nuevo login y copiar el nuevo token: cambiar el código no modifica la expiración de los tokens emitidos anteriormente.

Usar el nuevo token inmediatamente en `GET /api/profile`:

```text
200 OK
```

Esperar más de 10 segundos y volver a utilizar ese mismo token:

```text
401 Unauthorized
```

Después de la demostración restaurar:

```javascript
const ACCESS_TOKEN_TTL_SECONDS = 900;
```

Esperar el reinicio y realizar otro login para obtener un token con la duración habitual de 15 minutos.

---

# 36. Probar con Postman

Crear una colección:

```text
Node Security Demo
```

Agregar las siguientes requests:

```text
Health
Login - User
Login - Admin
Get Products
Get Profile
Create Product
Delete Product
```

## Login

```text
POST http://localhost:3000/auth/login
```

Body:

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

En la pestaña:

```text
Authorization
```

de las rutas protegidas seleccionar:

```text
Bearer Token
```

y pegar el JWT.

---

# 37. Matriz de pruebas

Los estudiantes deberían completar esta tabla.

| Caso | Token | Role | Endpoint | Resultado esperado |
|---|---|---|---|---|
| 1 | Ninguno | — | `GET /api/products` | `200` |
| 2 | Ninguno | — | `GET /api/profile` | `401` |
| 3 | Inválido | — | `GET /api/profile` | `401` |
| 4 | Válido | `user` | `GET /api/profile` | `200` |
| 5 | Válido | `user` | `POST /api/products` | `403` |
| 6 | Válido | `admin` | `POST /api/products` | `201` |
| 7 | Válido | `user` | `DELETE /api/products/1` | `403` |
| 8 | Válido | `admin` | `DELETE /api/products/1` | `200` |
| 9 | Ninguno | — | `POST /auth/login` sin cuerpo | `400` |
| 10 | Ninguno | — | `POST /auth/login` con password numérico | `400` |
| 11 | Ninguno | — | `POST /auth/login` con JSON mal formado | `400`, error JSON |
| 12 | Válido | `admin` | `POST /api/products` sin cuerpo | `400` |
| 13 | Válido | `admin` | `POST /api/products` con nombre objeto o precio negativo | `400` |
| 14 | Firmado, sin `exp`, `sub` o `role` | — | `GET /api/profile` | `401` |
| 15 | Válido, header `Bearer  TOKEN` | `user` | `GET /api/profile` | `200` |
| 16 | Válido, header `Bearer TOKEN extra` | `user` | `GET /api/profile` | `401` |
| 17 | Válido | `admin` | Crear tras crear producto 3 y borrar producto 1 | `201`, id `4` |

Los casos 14–16 usan tokens nuevos generados con la duración habitual. Para el caso 14, preparar tokens de prueba firmados con el secret de la demo, el emisor y la audiencia correctos, omitiendo un claim requerido a la vez. No usar un token sin firma: ese caso prueba otra validación.

El caso 17 continúa la secuencia de las secciones 31–32 sin reiniciar el servidor. Si se repiten las operaciones, el contador seguirá avanzando; para repetir la tabla desde los datos iniciales, reiniciar la aplicación.

---

# 38. Flujo completo de autenticación

```text
┌──────────┐
│ Client   │
└────┬─────┘
     │
     │ POST /auth/login
     │ email + password
     ▼
┌──────────────────┐
│ Auth Controller  │
└────┬─────────────┘
     │
     │ find user
     ▼
┌──────────────────┐
│ User Store       │
└────┬─────────────┘
     │
     │ passwordHash
     ▼
┌──────────────────┐
│ bcrypt.compare() │
└────┬─────────────┘
     │
     │ valid
     ▼
┌──────────────────┐
│ jwt.sign()       │
└────┬─────────────┘
     │
     │ access token
     ▼
┌──────────┐
│ Client   │
└──────────┘
```

---

# 39. Flujo completo de una ruta protegida

```text
Client
  │
  │ Authorization: Bearer <JWT>
  ▼
Express Router
  │
  ▼
requireAuth
  │
  ├── invalid ─────────► 401
  │
  └── valid
        │
        ▼
    req.user
        │
        ▼
 requireRole('admin')
        │
        ├── wrong role ─► 403
        │
        └── allowed
                │
                ▼
             Controller
                │
                ▼
             Response
```

---

# 40. ¿Por qué usamos middleware?

Sin middleware podríamos escribir:

```javascript
app.delete('/api/products/:id', (req, res) => {
  // verificar token
  // verificar usuario
  // verificar role
  // ejecutar operación
});
```

Y repetirlo en cada endpoint.

En lugar de eso:

```javascript
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  deleteProduct
);
```

tenemos responsabilidades separadas:

```text
requireAuth
→ identidad

requireRole
→ autorización

deleteProduct
→ lógica de negocio
```

Esto también mejora:

```text
reutilización
testabilidad
claridad
mantenimiento
```

Para el detalle de cómo se ejecutan en cadena (`next()`, el orden, la importancia del `return` y la closure de `requireRole`), ver la sección 13.

---

# 41. Ejercicio para los estudiantes

Agregar una nueva ruta:

```text
GET /api/admin/dashboard
```

Reglas:

```text
No token
→ 401

Token de role=user
→ 403

Token de role=admin
→ 200
```

Respuesta para admin:

```json
{
  "message": "Welcome to the admin dashboard",
  "userId": "user-1"
}
```

Los estudiantes deben decidir:

1. qué router crear;
2. qué middlewares agregar;
3. en qué orden;
4. qué controller implementar.

Resultado esperado conceptualmente:

```javascript
router.get(
  '/dashboard',
  requireAuth,
  requireRole('admin'),
  getDashboard
);
```

---

# 42. Ejercicio adicional: permitir varios roles

Actualmente:

```javascript
requireRole('admin')
```

solo admite un role.

Modificar el middleware para permitir:

```javascript
requireAnyRole(
  'admin',
  'manager'
)
```

Posible implementación:

```javascript
export function requireAnyRole(...allowedRoles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    next();
  };
}
```

Uso:

```javascript
router.post(
  '/',
  requireAuth,
  requireAnyRole('admin', 'manager'),
  createProduct
);
```

Esto introduce el concepto de:

```text
RBAC
Role-Based Access Control
```

Al introducir el rol `manager`, agregarlo también a la lista de roles permitidos en `requireAuth`:

```javascript
!['user', 'admin', 'manager'].includes(payload.role)
```

Esta expresión reemplaza `!['user', 'admin'].includes(payload.role)` en la condición de validación de claims. Para probar ese rol, crear una cuenta de demostración con `role: 'manager'` en `demoAccounts` y obtener su token mediante login. Cambiar únicamente `requireAnyRole` no basta: la autenticación también debe reconocer el nuevo rol.

---

# 43. Preguntas para discutir durante la clase

## Pregunta 1

¿JWT significa que el usuario está autenticado para siempre?

Respuesta:

```text
No.
```

El token tiene:

```text
exp
```

y debe expirar. La demo exige que `exp` esté presente y verifica que todavía no haya vencido.

---

## Pregunta 2

¿JWT cifra la información?

Respuesta:

```text
No necesariamente.
```

En esta demo el payload está firmado, no cifrado.

---

## Pregunta 3

¿Podemos confiar en un JWT únicamente porque tiene formato correcto?

Respuesta:

```text
No.
```

Debemos verificar:

```text
firma
expiración
algoritmo
issuer
audience
```

---

## Pregunta 4

¿Puede el cliente simplemente cambiar:

```json
{
  "role": "user"
}
```

por:

```json
{
  "role": "admin"
}
```

Respuesta:

Puede modificar el contenido localmente, pero la firma dejará de ser válida.

El servidor rechazará el token.

---

## Pregunta 5

¿Dónde debe ejecutarse la autorización?

Respuesta:

```text
En el servidor.
```

Ocultar un botón en el frontend **no es autorización**.

---

# 44. Qué simplifica esta demo

La demo utiliza:

```text
usuarios en memoria
productos en memoria
un solo servidor
un secret compartido HS256
roles simples
```

Esto es correcto para enseñar conceptos, pero no representa una arquitectura completa de producción.

---

# 45. Qué cambiar en producción

## Usuarios

Demo:

```text
src/data/users.js
```

Producción:

```text
PostgreSQL
MongoDB
Identity Provider
```

---

## Passwords

Demo:

```text
bcrypt
```

La aplicación genera hashes al arrancar para crear usuarios de ejemplo.

Producción:

```text
hash generado durante registro/cambio de password
hash almacenado persistentemente
nunca almacenar password en texto plano
```

---

## Secrets

Demo:

```text
.env
```

Producción:

```text
Secret Manager
Vault
Kubernetes Secret
```

---

## Authentication

Demo:

```text
POST /auth/login
+
JWT propio
```

En sistemas empresariales puede ser preferible utilizar:

```text
Auth0
Okta
Microsoft Entra ID
Keycloak
Amazon Cognito
Google Identity
```

según el contexto.

---

## JWT signing

Demo:

```text
HS256
```

En arquitecturas distribuidas puede ser conveniente utilizar criptografía asimétrica:

```text
RS256
ES256
```

de modo que:

```text
Identity Provider
     │
     │ private key
     ▼
  signs JWT

Services
     │
     │ public key
     ▼
 verify JWT
```

Los servicios pueden verificar tokens sin poseer la clave privada usada para firmarlos.

### HS256 frente a RS256 en detalle

| | HS256 (la demo) | RS256 / ES256 |
|---|---|---|
| Tipo | Simétrico (HMAC) | Asimétrico (par de claves) |
| Clave para **firmar** | `JWT_SECRET` | Clave **privada** |
| Clave para **verificar** | **La misma** `JWT_SECRET` | Clave **pública** |
| ¿Quién puede crear tokens? | Todo el que verifique | **Solo** quien tiene la clave privada |
| Tamaño de la firma | 43 caracteres | 342 caracteres (RSA 2048) |
| Complejidad | Baja | Mayor (gestión de llaves, JWKS) |

La diferencia clave es de **confianza**. Con HS256, cualquier servicio que necesite *verificar* un token también posee el secret, así que **también podría fabricarlos**. En una arquitectura con muchos servicios, un solo compromiso basta para emitir tokens falsos en todo el sistema.

Con RS256, los servicios solo tienen la clave pública. Pueden comprobar que un token es auténtico pero **no pueden crear uno**. La clave pública puede publicarse sin riesgo; los identity providers la exponen normalmente en un endpoint llamado **JWKS** (`/.well-known/jwks.json`).

Para esta demo HS256 es adecuado: hay un solo servidor que emite y verifica, así que no existe un tercero que deba verificar sin poder emitir.

> **Comprobado en la implementación:** un token firmado con RS256 enviado a un `verify` configurado con `algorithms: ['HS256']` se rechaza con `invalid algorithm`. Es otra razón para fijar la lista de algoritmos (ver sección 13).

### Dónde guardar el token en el cliente

La demo usa curl y Postman, donde el cliente simplemente copia el token. Con una aplicación web aparece la pregunta de **dónde lo guarda el navegador**. No hay una opción perfecta; cada una cambia el riesgo:

| Opción | Riesgo principal | Lo que la protege |
|---|---|---|
| `localStorage` / `sessionStorage` | **XSS**: cualquier script inyectado en la página puede leer el token (`localStorage.getItem(...)`) y enviarlo al atacante | Nada: JavaScript tiene acceso total |
| Cookie `HttpOnly` | **CSRF**: el navegador adjunta la cookie automáticamente a las peticiones, incluso las iniciadas desde otro sitio | `HttpOnly` impide que JavaScript la lea; `SameSite` y tokens CSRF mitigan el envío cruzado |
| Memoria de la aplicación (variable JS) | Se pierde al recargar la página | No es accesible desde otras pestañas ni persiste en disco |

Conceptos para explicar:

- **XSS (Cross-Site Scripting):** el atacante logra ejecutar su JavaScript dentro de tu página. Si el token está en `localStorage`, lo roba. La bandera `HttpOnly` de una cookie evita que ese script la lea, aunque el script aún podría hacer peticiones usando la sesión del usuario.
- **CSRF (Cross-Site Request Forgery):** un sitio malicioso hace que el navegador de la víctima envíe una petición a tu API. Si la autenticación viaja en una **cookie**, el navegador la adjunta sola.
- **Por qué la demo no tiene CSRF:** autentica con el header `Authorization: Bearer`, y ese header **lo añade explícitamente el código del cliente**; el navegador nunca lo envía por su cuenta. Al migrar el token a una cookie, el riesgo de CSRF aparece y hay que mitigarlo (`SameSite=Lax` o `Strict`, y/o tokens anti-CSRF).

Recomendación habitual para aplicaciones web: un access token de vida corta en memoria y un refresh token en una cookie `HttpOnly; Secure; SameSite`, que conecta con la sección 47. Es un compromiso, no una regla absoluta, y depende del modelo de amenazas de cada aplicación.

---

# 46. JWT no es OAuth

Es importante cerrar la sesión con esta distinción.

```text
JWT
│
└── formato para representar claims en un token

OAuth
│
└── framework de autorización
```

OAuth puede utilizar:

```text
JWT
```

como access token, pero:

```text
JWT ≠ OAuth
```

---

# 47. Access Token y Refresh Token

Nuestra demo implementa únicamente:

```text
Access Token
```

con duración corta:

```text
15 minutos
```

Un sistema más completo puede utilizar:

```text
Client
  │
  ├── Access Token
  │      │
  │      └── corta duración
  │
  └── Refresh Token
         │
         └── obtener un nuevo access token
```

El refresh token requiere decisiones adicionales sobre:

- almacenamiento seguro;
- rotación;
- revocación;
- detección de reutilización;
- expiración;
- logout.

No es necesario implementarlo en esta primera demo.

---

# 48. Errores comunes

## Error: `JWT_SECRET environment variable is required`

Verificar que exista:

```text
.env
```

con:

```env
JWT_SECRET=change-this-demo-secret-to-a-long-random-value
```

y ejecutar:

```bash
npm run dev
```

---

## Error: `Cannot use import statement outside a module`

Verificar en `package.json`:

```json
{
  "type": "module"
}
```

`npm init -y` genera `"type": "commonjs"`, así que este valor debe cambiarse manualmente.

---

## Error: `ERR_MODULE_NOT_FOUND`

Con ES Modules debe incluirse la extensión:

Incorrecto:

```javascript
import authRoutes from './routes/auth.routes';
```

Correcto:

```javascript
import authRoutes from './routes/auth.routes.js';
```

---

## Error: siempre devuelve 401

Verificar el header:

```http
Authorization: Bearer <token>
```

No:

```http
Authorization: <token>
```

Ni:

```http
Authentication: Bearer <token>
```

---

## Error: login devuelve `400` o siempre falla

Verificar que se está enviando:

```http
Content-Type: application/json
```

y que existe:

```javascript
app.use(express.json());
```

En Express 5, si no hay cuerpo o no se envía el tipo de contenido correcto, `req.body` puede ser `undefined`. Con la validación de la sección 9, estos casos devuelven `400` con `Email and password must be non-empty strings`. Enviar un password numérico también devuelve `400`; email y password deben ser cadenas no vacías.

Si aparece `500` con un error al desestructurar `req.body` o con `data and hash must be strings`, revisar que se haya copiado la versión completa del controller, incluido `req.body ?? {}` y la comprobación de tipos.

Un cuerpo JSON mal formado devuelve `400` con `Invalid JSON body` gracias al middleware de errores de la sección 20.

---

## Aviso: `npm warn allow-scripts ... bcrypt`

Ver la nota de la sección 2. Normalmente se puede ignorar; solo actuar si `bcrypt` falla al cargarse.

---

# 49. Checklist final

Al terminar la implementación debemos poder marcar:

- [ ] Node.js inicia la aplicación.
- [ ] `GET /health` responde `200`.
- [ ] `GET /api/products` es público.
- [ ] Login con credenciales válidas genera un JWT.
- [ ] Login inválido responde `401`.
- [ ] El JWT tiene expiración.
- [ ] `GET /api/profile` sin token responde `401`.
- [ ] `GET /api/profile` con token válido responde `200`.
- [ ] El middleware coloca identidad en `req.user`.
- [ ] `role=user` no puede crear productos.
- [ ] Intentar una operación admin con `role=user` responde `403`.
- [ ] `role=admin` puede crear productos.
- [ ] `role=admin` puede eliminar productos.
- [ ] Un token manipulado responde `401`.
- [ ] Un token expirado responde `401`.
- [ ] Los passwords se comparan mediante `bcrypt`.
- [ ] `.env` está excluido mediante `.gitignore`.
- [ ] Cuerpos ausentes y tipos de entrada inválidos responden `400`.
- [ ] Un JSON mal formado devuelve un error en formato JSON.
- [ ] El login informa la misma duración que la del JWT.
- [ ] Un token sin los claims requeridos responde `401`.
- [ ] Crear después de eliminar conserva ids únicos durante la ejecución.

---

# 50. Resultado final

Al finalizar tendremos el siguiente flujo:

```text
                         LOGIN
                           │
                           ▼
                ┌────────────────────┐
                │ POST /auth/login   │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │ Validate password  │
                │ using bcrypt       │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │ Generate JWT       │
                └─────────┬──────────┘
                          │
                          ▼
                     Access Token


                    PROTECTED API
                          │
                          ▼
                Authorization: Bearer
                          │
                          ▼
                 ┌──────────────────┐
                 │ requireAuth      │
                 └────────┬─────────┘
                          │
                    valid identity
                          │
                          ▼
                 ┌──────────────────┐
                 │ requireRole      │
                 └────────┬─────────┘
                          │
                     authorized
                          │
                          ▼
                 ┌──────────────────┐
                 │ Controller       │
                 └──────────────────┘
```

La idea principal que los estudiantes deben llevarse de la sesión es:

```text
Authentication
    =
¿Quién eres?

Authorization
    =
¿Qué puedes hacer?
```

y que una API segura no debe confiar en información de identidad enviada libremente por el cliente.

Debe:

```text
verificar credenciales
verificar tokens
verificar expiración
verificar permisos
proteger operaciones sensibles
```

---

# Referencias técnicas

- Node.js CLI documentation: https://nodejs.org/api/cli.html
- Node.js environment variables: https://nodejs.org/api/environment_variables.html
- Express 5 documentation: https://expressjs.com/
- Express 5 installation guide: https://expressjs.com/en/5x/starter/installing.html
- `jsonwebtoken`: https://www.npmjs.com/package/jsonwebtoken
- `bcrypt`: https://www.npmjs.com/package/bcrypt
