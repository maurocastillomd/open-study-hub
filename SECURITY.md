# Security

## Reporting a problem

Please report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Don't open a public issue for a security problem.

## How the hub handles your data

- There is no server and no account. Your profile, progress and lessons are stored in your own browser's local storage.
- Your Anthropic API key is stored only in your browser, separately from your progress, and is never included in a backup file. It is sent only to `api.anthropic.com`, and only when you build lessons from your sources.
- Source files you upload are sent from your browser to Anthropic with your key, and nowhere else.
- The page's Content Security Policy lets it run only its own files and contact only the Claude API.
- Backup files are treated as untrusted when you restore one: ids, settings and text are checked and anything unexpected is dropped.
- Don't save your API key on a shared or public computer. Remove it from Settings when you are done.
