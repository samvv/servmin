# Servmin

> Administer your servers with ease

## Installation

Currently, there is no straightforward method to install this software.

## Contributing

### First Steps

The following steps have to be done only once on each machine.

#### Configuring a localhost certificate

Due to a rather irritating decision by the Chrome devs, WebSocket connections
on `localhost` will be dropped if they not happen over TLS. In order to
circumvent this limitation and still be able to use the Vite development
server, we must create a local certificate authority (CA) and sign our
connection with that key.


1. Go inside the Servmin project directory.
2. Generate a `localhost.key` and `localhost.crt` using the following command:
   ```sh
   sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout config/localhost.key -out config/localhost.crt
   ```
3. Enter your details and make sure to fill in a CN (common name) of `localhost`.
4. Open settings in Brave and search for 'certificate'
5. Click on 'Security' → 'Manage device certificates' →  'Authorities' → 'Import'
6. Select in the file dialog the generated `localhost.crt` and make sure to check 'Trust this certificate for identifying websites'

That's it, the secure WebSocket should now work.

### Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
   parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
   },
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
