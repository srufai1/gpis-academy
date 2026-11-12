#!/usr/bin/env bash
# Builds the messy office folder for project 1.1 (m1-p1).
# Run by `academy init m1-p1`. Usage: seed.sh <lab-root>
set -euo pipefail

root="${1:?lab root is required}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rm -rf "$root"
mkdir -p "$root"/{reports/term-1,reports/term-2,finance,scripts,old/misc}
cd "$root"

# 1. The class list is in the wrong place.
cp "$here/class-list.txt" old/misc/class-list.txt

# 2. A name with a space, at the top level.
printf 'Open day: 14 March\nPTA meeting: 2 April\n' > "term 2 notes.txt"

# 3. A link to a folder that no longer exists.
ln -s reports/term2 current

# 4 and 5. Private money data that everyone can read.
printf 'student,amount\nSTU-000001,1500.00\nSTU-000002,1500.00\n' > finance/fees.csv
chmod 666 finance/fees.csv
chmod 777 finance

# 6. A script nobody can run, and everyone can change.
printf '#!/usr/bin/env bash\necho "backup ok"\n' > scripts/backup.sh
chmod 666 scripts/backup.sh

# 7. A setting to change.
cp "$here/settings.conf" settings.conf

# 8. Leftover temporary files, one of them hidden.
touch reports/term-1/draft.tmp old/.cache.tmp finance/export.tmp

echo "Lab ready: $root"
