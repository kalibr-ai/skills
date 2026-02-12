#!/usr/bin/env node
const { Command } = require('commander');
const chalk = require('chalk');
const Registry = require('./src/Registry');
const { v4: uuidv4 } = require('uuid');
const { CardProtocolSchema } = require('./src/CardProtocol'); // Use new strict protocol
const program = new Command();

program
  .name('clawbot-card')
  .description('The AI Business Card Protocol (FCC v1)')
  .version('2.0.0');

// Subcommand: list
program
  .command('list')
  .description('View your Rolodex (list saved cards)')
  .option('-v, --verbose', 'Show full details', false)
  .action((options) => {
    try {
        const cards = Registry.list();
        if (cards.length === 0) {
            console.log(chalk.yellow('Rolodex is empty. Start networking!'));
            return;
        }
        console.log(chalk.bold.underline(`\nRolodex (${cards.length})\n`));
        cards.forEach(card => {
            console.log(`  ${chalk.green('📇')} ${chalk.cyan(card.display_name)} [${card.id.slice(0,6)}]`);
            if (options.verbose) {
                console.log(`    Feishu: ${card.feishu_id}`);
                console.log(`    Bio: ${card.bio?.species} (${card.bio?.mbti || 'Unknown'})`);
                console.log(`    Capabilities: ${card.capabilities.join(', ') || 'None'}`);
                console.log('');
            }
        });
    } catch (err) {
        console.error(chalk.red('Error listing cards:'), err.message);
    }
  });

// Subcommand: export (was get)
program
  .command('export')
  .argument('<query>', 'Name, ID, or FeishuID')
  .description('Generate a shareable Card JSON (to send)')
  .action((query) => {
    try {
        const card = Registry.get(query);
        if (!card) {
          console.error(chalk.red(`Card not found: ${query}`));
          process.exit(1);
        }
        // Export only the card protocol fields
        const payload = CardProtocolSchema.parse(card);
        console.log(JSON.stringify(payload, null, 2));
    } catch (err) {
        console.error(chalk.red('Card integrity error!'), err.message);
    }
  });

// Subcommand: mint (was add)
program
  .command('mint')
  .description('Mint a new identity card')
  .argument('<json>', 'Full or partial JSON')
  .action((jsonStr) => {
    try {
      const input = JSON.parse(jsonStr);
      
      // Auto-fill protocol metadata if missing
      const now = new Date().toISOString();
      const payload = {
          protocol: "fcc-v1",
          id: input.id || uuidv4(),
          ...input,
          meta: {
              version: "1.0.0",
              created_at: now,
              updated_at: now,
              ...(input.meta || {})
          }
      };

      const newCard = Registry.add(payload); // Registry now uses Protocol Schema internally? No, need to update Registry.js too.
      console.log(chalk.green(`✓ Minted card for "${newCard.display_name}"`));
      console.log(`  ID: ${newCard.id}`);
    } catch (err) {
      console.error(chalk.red('Mint failed:'), err.message);
      if (err.issues) console.log(err.issues);
    }
  });

// Subcommand: import (was add)
program
  .command('import')
  .description('Import a received card JSON')
  .argument('<json>', 'Received Card JSON')
  .action((jsonStr) => {
      try {
          const card = JSON.parse(jsonStr);
          // Strict validation: must adhere to FCC v1
          const validated = CardProtocolSchema.parse(card);
          Registry.add(validated);
          console.log(chalk.green(`✓ Imported card from "${validated.display_name}"`));
      } catch (err) {
          console.error(chalk.red('Invalid card format! Rejecting.'), err.message);
      }
  });

// Subcommand: delete
program
  .command('delete')
  .argument('<id>', 'Card ID to burn')
  .description('Remove a card from rolodex')
  .action((id) => {
    try {
      Registry.delete(id);
      console.log(chalk.green(`✓ Card ${id} burned.`));
    } catch (err) {
      console.error(chalk.red('Burn failed:'), err.message);
    }
  });

program.parse();
