#!/usr/bin/env fish

# 🐳 Script Helper para Docker - OJA Backend

set COMPOSE_FILE (dirname (status -f))/docker-compose.yml

function show_menu
    echo ""
    echo "🐳 OJA Docker Manager"
    echo "====================="
    echo ""
    echo "Serviços disponíveis:"
    echo "  [1] PostgreSQL      (porta 5432)"
    echo "  [2] Adminer         (http://localhost:8080)"
    echo ""
    echo "Ações:"
    echo "  [s] Start   - Iniciar serviços"
    echo "  [p] Stop    - Parar serviços"
    echo "  [r] Restart - Reiniciar serviços"
    echo "  [l] Logs    - Ver logs"
    echo "  [c] Connect - Conectar ao PostgreSQL"
    echo "  [b] Backup  - Fazer backup do banco"
    echo "  [i] Info    - Informações e status"
    echo "  [q] Quit    - Sair"
    echo ""
end

function start_services
    echo "🚀 Qual serviço deseja iniciar?"
    echo "  [1] Todos"
    echo "  [2] Apenas PostgreSQL"
    echo "  [3] PostgreSQL + Adminer"
    echo ""
    read -P "Escolha: " choice

    switch $choice
        case 1
            echo "🔄 Iniciando todos os serviços..."
            docker-compose -f $COMPOSE_FILE up -d
        case 2
            echo "🔄 Iniciando PostgreSQL..."
            docker-compose -f $COMPOSE_FILE up -d postgres
        case 3
            echo "🔄 Iniciando PostgreSQL + Adminer..."
            docker-compose -f $COMPOSE_FILE up -d postgres adminer
        case '*'
            echo "❌ Opção inválida"
            return
    end

    echo ""
    echo "✅ Serviços iniciados!"
    sleep 2
    show_status
end

function stop_services
    echo "🛑 Parando serviços..."
    docker-compose -f $COMPOSE_FILE stop
    echo "✅ Serviços parados!"
    sleep 1
end

function restart_services
    echo "🔄 Reiniciando serviços..."
    docker-compose -f $COMPOSE_FILE restart
    echo "✅ Serviços reiniciados!"
    sleep 1
end

function show_logs
    echo "📋 Logs de qual serviço?"
    echo "  [1] Todos"
    echo "  [2] PostgreSQL"
    echo "  [3] Adminer"
    echo ""
    read -P "Escolha: " choice

    switch $choice
        case 1
            docker-compose -f $COMPOSE_FILE logs -f
        case 2
            docker-compose -f $COMPOSE_FILE logs -f postgres
        case 3
            docker-compose -f $COMPOSE_FILE logs -f adminer
        case '*'
            echo "❌ Opção inválida"
    end
end

function connect_db
    echo "🔌 Conectando ao PostgreSQL..."
    echo ""
    docker exec -it oja-db psql -U ismael -d oja_db
end

function backup_db
    set backup_dir (dirname $COMPOSE_FILE)/backups
    mkdir -p $backup_dir
    
    set timestamp (date +%Y%m%d-%H%M%S)
    set backup_file "$backup_dir/backup-$timestamp.sql.gz"
    
    echo "💾 Fazendo backup do banco..."
    docker exec oja-db pg_dump -U ismael -d oja_db | gzip > $backup_file
    
    if test $status -eq 0
        set size (du -h $backup_file | cut -f1)
        echo "✅ Backup criado: $backup_file ($size)"
    else
        echo "❌ Erro ao criar backup!"
    end
    
    echo ""
    read -P "Pressione ENTER para continuar..."
end

function show_status
    echo ""
    echo "📊 Status dos Serviços:"
    echo "======================="
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    echo "🔗 URLs de Acesso:"
    echo "=================="
    
    if docker ps | grep -q oja-db
        echo "  ✅ PostgreSQL:  localhost:5432"
    else
        echo "  ❌ PostgreSQL:  (offline)"
    end
    
    if docker ps | grep -q oja-adminer
        echo "  ✅ Adminer:     http://localhost:8080"
    else
        echo "  ❌ Adminer:     (offline)"
    end
    
    echo ""
    echo "📋 Credenciais:"
    echo "==============="
    echo "  PostgreSQL:"
    echo "    Host:     localhost"
    echo "    Port:     5432"
    echo "    Database: oja_db"
    echo "    User:     ismael"
    echo "    Password: 01032000"
    echo ""
    echo "  Adminer:"
    echo "    Server:   host.docker.internal"
    echo "    Username: ismael"
    echo "    Password: 01032000"
    echo ""
    
    # Estatísticas do banco
    if docker ps | grep -q oja-db
        echo "📊 Estatísticas do Banco:"
        echo "========================="
        set deputados (docker exec oja-db psql -U ismael -d oja_db -t -c "SELECT COUNT(*) FROM deputados;" 2>/dev/null | string trim)
        set despesas (docker exec oja-db psql -U ismael -d oja_db -t -c "SELECT COUNT(*) FROM despesas;" 2>/dev/null | string trim)
        
        if test -n "$deputados"
            echo "  Deputados: $deputados"
        end
        if test -n "$despesas"
            echo "  Despesas:  $despesas"
        end
    end
    
    echo ""
end

# Main loop
while true
    show_menu
    read -P "Escolha uma opção: " option

    switch $option
        case s S
            start_services
        case p P
            stop_services
        case r R
            restart_services
        case l L
            show_logs
        case c C
            connect_db
        case b B
            backup_db
        case i I
            show_status
            echo ""
            read -P "Pressione ENTER para continuar..."
        case q Q
            echo "👋 Até logo!"
            exit 0
        case '*'
            echo "❌ Opção inválida!"
            sleep 1
    end
    
    clear
end
