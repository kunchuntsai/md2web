for file in files/*.md; do
  node src/cli.js convert "$file" --force
done
