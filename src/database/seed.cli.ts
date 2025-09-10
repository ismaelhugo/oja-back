#!/usr/bin/env ts-node
import { SeederService } from './seed.config';

const command = process.argv[2];

async function main() {
    const seeder = new SeederService();
    
    switch (command) {
        case 'run':
            await seeder.run();
            break;
        case 'force':
            await seeder.runForce();
            break;
        case 'drop':
            await seeder.drop();
            break;
        case 'refresh':
            await seeder.drop();
            await seeder.run();
            break;
        default:
            console.log('Comandos disponíveis:');
            console.log('  npm run seed:run     # Executa seeds');
            console.log('  npm run seed:force   # Força reimportação');
            console.log('  npm run seed:drop    # Limpa dados');
            console.log('  npm run seed:refresh # Limpa e executa seeds');
    }
    
    process.exit(0);
}

main().catch(error => {
    console.error('Erro:', error);
    process.exit(1);
});
