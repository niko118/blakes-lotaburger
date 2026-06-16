#!/usr/bin/env node

/**
 * Database Commands Help
 * 
 * Shows all available database commands and quick reference
 */

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function title(message) {
  log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`);
}

function command(cmd, description) {
  log(`  ${colors.green}${cmd.padEnd(30)}${colors.reset}${colors.blue}${description}${colors.reset}`);
}

function section(name) {
  log(`\n${colors.yellow}${name}:${colors.reset}`);
}

console.clear();

log('\n' + '='.repeat(70), 'cyan');
title('                  Database Commands Reference');
log('='.repeat(70) + '\n', 'cyan');

// Local Development
section('Local Development (Supabase)');
command('npm run db:local:start', 'Start local Supabase stack (PostgreSQL + Auth + Storage)');
command('npm run db:local:stop', 'Stop local Supabase');
command('npm run db:local:reset', 'Reset local database to clean state');
command('npm run db:local:status', 'Show status of local Supabase services');

// Data Sync
section('Data Synchronization');
command('npm run db:local:sync', 'Sync data from PROD to your local database');
log(`  ${colors.magenta}  └─ Requires: SUPABASE_PROD_DB_URL (Session pooler, port 6543)${colors.reset}`);

// Migrations
section('Database Migrations');
command('npm run db:generate', 'Generate new migration from schema changes');
command('npm run db:migrate', 'Apply pending migrations to database');
log(`  ${colors.magenta}  └─ Works with: Local (localhost:54322) or remote (via DATABASE_URL)${colors.reset}`);

// Setup
section('Initial Setup');
command('cp apps/web/env.example apps/web/.env.local', 'Copy environment template');
log(`  ${colors.magenta}  └─ Then edit apps/web/.env.local with your values${colors.reset}`);

// Help
section('Documentation');
command('npm run db:help', 'Show this help message (you are here!)');

// Quick workflows
log('\n' + '─'.repeat(70), 'cyan');
title('Common Workflows');
log('─'.repeat(70), 'cyan');

section('First Time Setup');
log('  1. cp apps/web/env.example apps/web/.env.local');
log('  2. Edit apps/web/.env.local with your values');
log('  3. npm run db:local:start');
log('  4. npm run db:local:sync          # Optional: get PROD data');

section('Daily Development');
log('  1. npm run db:local:start');
log('  2. npm run dev');
log('  3. ... work on features ...');
log('  4. npm run db:local:stop          # End of day');

section('Creating a Migration');
log('  1. Edit: apps/web/lib/db/schema.ts');
log('  2. npm run db:generate');
log('  3. npm run db:migrate');
log('  4. Test changes locally');
log('  5. Commit and push to dev branch');

section('After Pulling New Code');
log('  1. git pull origin dev');
log('  2. npm run db:migrate             # Apply new migrations');
log('  3. npm run dev');

// Access info
log('\n' + '─'.repeat(70), 'cyan');
title('Local Services Access');
log('─'.repeat(70), 'cyan');

log(`\n  ${colors.cyan}Database:${colors.reset}        postgresql://postgres:postgres@localhost:54322/postgres`);
log(`  ${colors.cyan}Supabase Studio:${colors.reset} http://localhost:54323`);
log(`  ${colors.cyan}API Endpoint:${colors.reset}    http://localhost:54321`);
log(`  ${colors.cyan}Next.js App:${colors.reset}     http://localhost:3000`);

log('\n' + '─'.repeat(70), 'cyan');
title('DATABASE_URL for apps/web/.env.local');
log('─'.repeat(70), 'cyan');

log(`\n  ${colors.green}Copy this to your apps/web/.env.local file:${colors.reset}`);
log(`\n  ${colors.bold}${colors.yellow}DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres${colors.reset}`);
log(`\n  ${colors.magenta}This connects your Next.js app to local Supabase${colors.reset}`);

// Prerequisites
log('\n' + '─'.repeat(70), 'cyan');
title('Prerequisites');
log('─'.repeat(70), 'cyan');

log(`\n  ${colors.green}✓${colors.reset} Docker Desktop running`);
log(`  ${colors.green}✓${colors.reset} Supabase CLI:   brew install supabase/tap/supabase`);
log(`  ${colors.green}✓${colors.reset} PostgreSQL 17:   brew install postgresql@17`);
log(`  ${colors.green}✓${colors.reset} Node.js 18+`);

// Documentation
log('\n' + '─'.repeat(70), 'cyan');
title('Full Documentation');
log('─'.repeat(70), 'cyan');

log(`\n  ${colors.blue}📖 Local Development Guide:${colors.reset} docs/local-development-setup.md`);
log(`  ${colors.blue}📖 Deployment Workflow:${colors.reset}     docs/deployment-workflow.md`);

// Troubleshooting
log('\n' + '─'.repeat(70), 'cyan');
title('Quick Troubleshooting');
log('─'.repeat(70), 'cyan');

log(`\n  ${colors.yellow}Issue:${colors.reset} Port 54322 already in use`);
log(`  ${colors.blue}Fix:${colors.reset}   npm run db:local:stop`);

log(`\n  ${colors.yellow}Issue:${colors.reset} Cannot connect to Docker`);
log(`  ${colors.blue}Fix:${colors.reset}   Start Docker Desktop`);

log(`\n  ${colors.yellow}Issue:${colors.reset} Sync fails (timeout or "PREPARE statements")`);
log(`  ${colors.blue}Fix:${colors.reset}   Wrong connection type - need Session pooler (port 6543)`);
log(`  ${colors.blue}     ${colors.reset}   Supabase → Connect → Session Pooler`);
log(`  ${colors.blue}     ${colors.reset}   URL must end with :6543/postgres (NOT :5432)`);

log(`\n  ${colors.yellow}Issue:${colors.reset} Migration already exists error`);
log(`  ${colors.blue}Fix:${colors.reset}   npm run db:local:reset && npm run db:migrate`);

// Footer
log('\n' + '='.repeat(70), 'cyan');
log(`${colors.cyan}Need more help? Check the full documentation or ask the team!${colors.reset}`);
log('='.repeat(70) + '\n', 'cyan');

