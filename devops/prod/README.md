# Secretos de producción — SOPS + age

Cierra la decisión que `devops/README.md` § "Cyberseguridad del VPS" dejaba abierta ("SOPS + age
... o un gestor de secretos dedicado"): **SOPS + age**, sin infraestructura adicional que correr,
respaldar o mantener disponible — coherente con el resto de este repo (todo versionado en git,
`docker-compose.yml` sobre un único VPS, sin Kubernetes ni PaaS gestionado, ver
`devops/README.md`).

## Por qué SOPS+age y no un gestor dedicado

Un gestor dedicado (Vault, Infisical, AWS Secrets Manager) tiene sentido cuando hace falta
rotación dinámica de credenciales o ACLs finos entre varios equipos. Acá el despliegue es un solo
VPS con Docker Compose y, hoy, un operador — un gestor dedicado sería un servicio más para correr,
sellar/desellar (Vault) y respaldar, con un problema de arranque circular (¿dónde vive el secreto
que abre al gestor de secretos?). SOPS+age no tiene ese problema: el archivo cifrado vive en git
como cualquier otro archivo versionado, y solo la clave privada `age` (que nunca toca el repo)
hace falta para leerlo.

**Trade-off aceptado**: sin rotación automática ni revocación centralizada — la clave privada la
custodia el operador del VPS a mano (gestor de contraseñas u offline). Si el equipo crece y hace
falta acceso diferenciado por persona, ahí sí migrar a un gestor dedicado (decisión futura, no
bloqueante hoy).

## Instalación de las herramientas

- **sops**: https://github.com/getsops/sops — `scoop install sops` (Windows), `brew install sops`
  (macOS), o el binario del release de GitHub en el VPS (Linux).
- **age**: cualquier implementación compatible con el formato estándar sirve — `age` de
  FiloSottile o `rage` (https://github.com/str4d/rage, Rust, mismos binarios `age`/`age-keygen` o
  `rage`/`rage-keygen` según el paquete). SOPS no distingue cuál generó la clave.

## Generar la clave real (una vez, por operador)

```bash
age-keygen -o ~/.config/sops/age/keys.txt   # o rage-keygen, mismo formato
```

Esto imprime la clave pública (`age1...`) — copiarla a `.sops.yaml` (raíz del repo, reemplazar el
placeholder `age1REEMPLAZAR_...`). La clave **privada** (`AGE-SECRET-KEY-1...`, en el archivo
`keys.txt`) **nunca se commitea** — vive solo en la máquina del operador y, en el VPS, en el mismo
path o en `$SOPS_AGE_KEY_FILE`. Perder esta clave sin backup significa perder acceso a todos los
secretos cifrados con ella — guardar una copia offline (gestor de contraseñas, USB cifrado).

Con más de un operador, cada uno genera su propia clave y agrega su pública a `.sops.yaml` — SOPS
cifra para todos los recipients listados, cualquiera puede descifrar con la suya.

## Flujo

```bash
# Primera vez: copiar la plantilla y completar valores reales
cp devops/prod/prod.example.yaml devops/prod/prod.enc.yaml
# editar devops/prod/prod.enc.yaml con los valores reales de producción

# Cifrar in-place (usa la config de .sops.yaml, detecta el archivo por su nombre)
sops -e -i devops/prod/prod.enc.yaml
# ahora sí se commitea — está cifrado
git add devops/prod/prod.enc.yaml

# Editar un secreto ya cifrado (descifra en un editor temporal, vuelve a cifrar al guardar)
sops devops/prod/prod.enc.yaml

# Descifrar a stdout (para inyectar en el deploy, nunca para dejarlo en un archivo plano)
sops -d devops/prod/prod.enc.yaml
```

`.sops.yaml` reconoce el archivo por su nombre (`devops/prod/*.enc.{yaml,yml,json,env}`) — no
hace falta pasar `--config` a mano en cada comando.

**Nota Windows**: el `path_regex` de `.sops.yaml` usa `devops[/\\]prod[/\\]...` (no
`devops/prod/...` a secas) — verificado que SOPS en Windows no matchea una barra `/` literal en
el path_regex contra el separador real del filesystem; con la clase de caracteres `[/\\]` funciona
en Windows y Linux por igual. Si se edita ese regex, volver a probar un roundtrip
cifrar→commitear→descifrar antes de confiar en él.

## Uso en el deploy (cuando exista el VPS real)

El pipeline de `devops/README.md` § "Pipeline CI/CD" descifra en el paso de deploy, nunca antes:
la clave privada age vive como secreto de GitHub Actions (`SOPS_AGE_KEY`, el contenido del
`keys.txt`, no un archivo) solo para el job de deploy a producción, no para CI de PRs. Ejemplo del
paso relevante:

```yaml
- name: Descifrar secretos de producción
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
  run: sops -d devops/prod/prod.enc.yaml > /tmp/prod.env
```

El archivo descifrado (`/tmp/prod.env` arriba) nunca se commitea ni se loguea — vive solo en el
runner efímero del job, se descarta al terminar.

## Documentos relacionados

`devops/README.md` § "Cyberseguridad del VPS" (decisión original, ahora cerrada acá) y § "Pipeline
CI/CD" (dónde encaja el paso de descifrado). `devops/local/.env.example` (mismas variables, para
el ambiente local sin cifrar — ese sí puede vivir en texto plano porque nunca se commitea, ver
`.gitignore` raíz).
