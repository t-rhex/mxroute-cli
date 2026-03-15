import inquirer from 'inquirer';
import { theme } from '../utils/theme';
import { categories, commandExamples, findCategory, findCommand } from '../utils/command-registry';

export async function guideCommand(topic?: string): Promise<void> {
  if (!topic) {
    // Interactive category picker
    const categoryNames = Object.keys(categories);
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'What do you need help with?',
        choices: categoryNames.map((name) => ({
          name: `${name} — ${categories[name].description}`,
          value: name,
        })),
      },
    ]);
    showCategoryByKey(selected);
    return;
  }

  // Try as category first
  const cat = findCategory(topic);
  if (cat) {
    showCategoryByKey(Object.keys(categories).find((k) => categories[k] === cat) || cat.name);
    return;
  }

  // Try as command
  const cmd = findCommand(topic);
  if (cmd) {
    showCommandInfo(topic, cmd);
    return;
  }

  // Not found
  console.log(theme.warning(`\n  Topic "${topic}" not found.\n`));
  console.log(theme.muted(`  Available topics:`));
  Object.keys(categories).forEach((name) => {
    console.log(theme.muted(`    ${name}`));
  });
  console.log(theme.muted(`\n  Or try a command name: mxroute guide "dns check"\n`));
}

function showCategoryByKey(name: string): void {
  const cat = categories[name];
  console.log(theme.heading(name));
  console.log(theme.muted(`  ${cat.description}\n`));

  console.log(theme.subheading('Commands'));
  for (const cmd of cat.commands) {
    const info = commandExamples[cmd] || commandExamples[cmd + ' list'];
    const desc = info ? info.description : '';
    console.log(`    ${theme.bold(cmd.padEnd(24))} ${theme.muted(desc)}`);
  }
  console.log('');

  // Show examples for first few commands
  const withExamples = cat.commands.filter((c) => commandExamples[c] || commandExamples[c + ' list']).slice(0, 3);
  if (withExamples.length > 0) {
    console.log(theme.subheading('Examples'));
    for (const cmd of withExamples) {
      const info = commandExamples[cmd] || commandExamples[cmd + ' list'];
      if (info) {
        console.log(theme.muted(`    ${info.examples[0]}`));
      }
    }
    console.log('');
  }
}

function showCommandInfo(name: string, cmd: any): void {
  console.log(theme.heading(`mxroute ${name}`));
  console.log(theme.muted(`  ${cmd.description}\n`));

  console.log(theme.subheading('Examples'));
  for (const ex of cmd.examples) {
    console.log(theme.muted(`    ${ex}`));
  }

  if (cmd.related.length > 0) {
    console.log('');
    console.log(theme.subheading('Related'));
    console.log(theme.muted(`    ${cmd.related.join(', ')}`));
  }
  console.log('');
}
