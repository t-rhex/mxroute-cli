import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { theme } from '../utils/theme';
import { getConfig } from '../utils/config';
import { sendEmail } from '../utils/api';
import { validateEmail } from '../utils/shared';
import ora from 'ora';

const TEMPLATES_DIR = path.join(require('os').homedir(), '.config', 'mxroute-cli', 'templates');

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  isHtml: boolean;
  variables: string[];
  createdAt: string;
}

function ensureTemplatesDir(): void {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true, mode: 0o700 });
  }
}

function listTemplateFiles(): string[] {
  ensureTemplatesDir();
  try {
    return fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

function loadTemplate(name: string): EmailTemplate | null {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${name}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTemplate(template: EmailTemplate): void {
  ensureTemplatesDir();
  const filePath = path.join(TEMPLATES_DIR, `${template.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(template, null, 2), { mode: 0o600 });
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function replaceVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export async function templatesList(): Promise<void> {
  console.log(theme.heading('Email Templates'));

  const templates = listTemplateFiles();

  if (templates.length === 0) {
    console.log(theme.muted('  No templates saved yet.'));
    console.log(theme.muted(`  Create one with: ${theme.bold('mxroute templates save')}\n`));
    return;
  }

  for (const name of templates) {
    const t = loadTemplate(name);
    if (t) {
      const vars = t.variables.length > 0 ? theme.muted(` (vars: ${t.variables.join(', ')})`) : '';
      console.log(`  ${theme.statusIcon('info')} ${theme.bold(t.name)}${vars}`);
      console.log(theme.muted(`      Subject: ${t.subject}`));
      console.log(
        theme.muted(`      Type: ${t.isHtml ? 'HTML' : 'Plain text'} | Created: ${t.createdAt.split('T')[0]}`),
      );
    }
  }
  console.log('');
}

export async function templatesSave(): Promise<void> {
  console.log(theme.heading('Save Email Template'));
  console.log(theme.muted('  Use {{variable}} syntax for dynamic content.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: theme.secondary('Template name:'),
      validate: (input: string) => {
        if (!input.trim()) return 'Name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'Use only letters, numbers, hyphens, and underscores';
        return true;
      },
    },
    {
      type: 'input',
      name: 'subject',
      message: theme.secondary('Subject line:'),
      validate: (input: string) => (input.trim() ? true : 'Subject is required'),
    },
    {
      type: 'confirm',
      name: 'isHtml',
      message: 'Is the body HTML?',
      default: false,
    },
    {
      type: 'editor',
      name: 'body',
      message: theme.secondary('Email body (opens editor):'),
    },
  ]);

  const variables = [...new Set([...extractVariables(answers.subject), ...extractVariables(answers.body)])];

  const template: EmailTemplate = {
    name: answers.name,
    subject: answers.subject,
    body: answers.body,
    isHtml: answers.isHtml,
    variables,
    createdAt: new Date().toISOString(),
  };

  // Check if exists
  if (loadTemplate(answers.name)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Template "${answers.name}" already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(theme.muted('\n  Cancelled.\n'));
      return;
    }
  }

  saveTemplate(template);

  console.log(theme.success(`\n  ${theme.statusIcon('pass')} Template "${answers.name}" saved.`));
  if (variables.length > 0) {
    console.log(theme.muted(`  Variables: ${variables.join(', ')}`));
  }
  console.log(theme.muted(`  Use with: ${theme.bold(`mxroute templates send ${answers.name}`)}\n`));
}

export async function templatesSend(templateName?: string): Promise<void> {
  const config = getConfig();

  if (!config.server || !config.username || !config.password) {
    console.log(
      theme.error(
        `\n  ${theme.statusIcon('fail')} SMTP not configured. Run ${theme.bold('mxroute config smtp')} first.\n`,
      ),
    );
    process.exit(1);
  }

  // Pick template
  if (!templateName) {
    const templates = listTemplateFiles();
    if (templates.length === 0) {
      console.log(
        theme.error(
          `\n  ${theme.statusIcon('fail')} No templates found. Create one with: ${theme.bold('mxroute templates save')}\n`,
        ),
      );
      process.exit(1);
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select template:',
        choices: templates,
      },
    ]);
    templateName = selected;
  }

  const template = loadTemplate(templateName!);
  if (!template) {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Template "${templateName}" not found.\n`));
    process.exit(1);
  }

  console.log(theme.heading(`Send Template: ${template.name}`));

  // Collect variable values
  const varValues: Record<string, string> = {};
  if (template.variables.length > 0) {
    console.log(theme.muted('  Fill in template variables:\n'));
    for (const varName of template.variables) {
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: theme.secondary(`{{${varName}}}:`),
          validate: (input: string) => (input.trim() ? true : 'Value is required'),
        },
      ]);
      varValues[varName] = value;
    }
  }

  const { to } = await inquirer.prompt([
    {
      type: 'input',
      name: 'to',
      message: theme.secondary('Recipient email:'),
      validate: validateEmail,
    },
  ]);

  const finalSubject = replaceVariables(template.subject, varValues);
  const finalBody = replaceVariables(template.body, varValues);

  console.log('');
  console.log(theme.keyValue('To', to));
  console.log(theme.keyValue('Subject', finalSubject));
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Send this email?',
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora({ text: 'Sending...', spinner: 'dots12', color: 'cyan' }).start();

  try {
    const result = await sendEmail({
      server: `${config.server}.mxrouting.net`,
      username: config.username,
      password: config.password,
      from: config.username,
      to,
      subject: finalSubject,
      body: template.isHtml ? finalBody : `<pre style="font-family: system-ui, sans-serif;">${finalBody}</pre>`,
    });

    if (result.success) {
      spinner.succeed(chalk.green(`Email sent to ${to}`));
    } else {
      spinner.fail(chalk.red(result.message));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(err.message));
  }
  console.log('');
}

export async function templatesDelete(templateName?: string): Promise<void> {
  if (!templateName) {
    const templates = listTemplateFiles();
    if (templates.length === 0) {
      console.log(theme.muted('\n  No templates to delete.\n'));
      return;
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select template to delete:',
        choices: templates,
      },
    ]);
    templateName = selected;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete template "${templateName}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(theme.muted('\n  Cancelled.\n'));
    return;
  }

  try {
    fs.unlinkSync(path.join(TEMPLATES_DIR, `${templateName}.json`));
    console.log(theme.success(`\n  ${theme.statusIcon('pass')} Template "${templateName}" deleted.\n`));
  } catch {
    console.log(theme.error(`\n  ${theme.statusIcon('fail')} Template "${templateName}" not found.\n`));
  }
}
