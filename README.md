# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Calendário de Abastecimento (Custom)

Foi adicionado um endpoint interno para consumir o serviço ArcGIS da Compesa e expor um formato simplificado para o front.

Endpoint: `GET /api/calendar?area=ARDV136690&year=2025&month=9`

Parâmetros:
- `area` (string) ID_AREA_ABASTECIMENTO.
- `year` (number)
- `month` (1-12)

Resposta:
```json
{
	"area": "ARDV136690",
	"year": 2025,
	"month": 9,
	"days": {
		"2025-09-03": "manutencao",
		"2025-09-04": "abastecimento-parcial"
	}
}
```

Status possíveis de cada dia:
- `abastecimento`
- `abastecimento-parcial`
- `manutencao`
- `sem-abastecimento` (aplicado no client quando não há registro)

Heurística inicial de classificação usa palavras-chave de `DESCRICAO_SERVICO` (pode ser refinada depois com mapeamento oficial).

### Próximos passos sugeridos
- Cache (ex: 1h) em `server/api/calendar.get.ts`.
- Lista de áreas com autocomplete (outra layer / endpoint de metadados se disponível).
- Testes unitários para classificação.
- Internacionalização e tema escuro.

## Seletor Hierárquico de Área

Foram adicionados endpoints para permitir seleção amigável:

1. `GET /api/areas/municipios` -> `{ municipios: string[] }`
2. `GET /api/areas/bairros?municipio=ARARIPINA` -> `{ municipio, bairros: string[], codigos: { [nome]: codigo } }`
3. `GET /api/areas/abastecimentos?municipio=ARARIPINA&bairro=CENTRO` -> `{ areas: [{ id, nome, municipios, bairros }] }`

O componente `AreaHierarchySelector.vue` usa esses endpoints para montar três `<select>` encadeados e emite o `id` final (campo `ID` da layer 0) que corresponde ao `ID_AREA_ABASTECIMENTO` usado no endpoint `/api/calendar`.

Observações:
- Filtro de bairro usa `LIKE '%bairro%'` (pode trazer áreas adicionais se o nome for substring comum).
- Dados retornam nomes e podem conter múltiplos bairros separados por vírgula dentro de uma mesma área.
- Melhorias futuras: paginação, busca textual incremental e cache.

