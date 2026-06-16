---
to: index.html
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><%= title(name) %></title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #f5f5f5; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
