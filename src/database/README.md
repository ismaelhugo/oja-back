# Database Management

Este projeto utiliza TypeORM para gerenciamento de banco de dados com migrations e seeds separados.

## Estrutura

```
src/database/
├── migrations/     # Scripts de mudanças na estrutura do banco
├── seeds/         # Scripts para popular o banco com dados iniciais
├── factories/     # (Futuro) Fábricas para gerar dados de teste
├── seed.config.ts # Configuração do sistema de seeds
└── seed.cli.ts    # CLI para executar seeds
```

## Comandos Disponíveis

### Migrations
```bash
# Gerar migration baseada nas mudanças das entities
npm run migration:generate src/database/migrations/NomeDaMigration

# Criar migration em branco
npm run migration:create src/database/migrations/NomeDaMigration

# Executar migrations pendentes
npm run migration:run

# Reverter última migration
npm run migration:revert

# Ver status das migrations
npm run migration:show
```

### Seeds
```bash
# Executar seeds (popular banco)
npm run seed:run

# Limpar dados do banco
npm run seed:drop

# Limpar e re-popular banco
npm run seed:refresh

# Setup completo (migrations + seeds)
npm run db:setup
```

### Import Legado
```bash
# Importar deputados usando CLI existente
npm run import:deputados atuais
npm run import:deputados todos
npm run import:deputados legislatura 56
```

## Fluxo de Desenvolvimento

1. **Primeira vez:**
   ```bash
   npm run migration:run    # Criar estrutura
   npm run seed:run         # Popular com dados
   ```

2. **Mudanças na estrutura:**
   ```bash
   # Modificar entity
   npm run migration:generate src/database/migrations/AlteracaoTabela
   npm run migration:run
   ```

3. **Reset completo:**
   ```bash
   npm run seed:refresh
   ```

## Ambientes

- **Desenvolvimento:** Use seeds para dados de teste
- **Produção:** Apenas migrations, dados reais via API
- **Testes:** Use factories (futuro) para dados isolados
