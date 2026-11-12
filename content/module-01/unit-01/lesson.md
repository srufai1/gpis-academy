# Lesson — The terminal and the filesystem

## 1. Why the terminal

A terminal lets you tell the computer exactly what to do, in words. Every tool in this
course (Git, Node.js, the checker, Supabase) is driven from it. A server has no desktop, so
this is also how real systems are run.

You type a **command**, press Enter, and read the **output**.

```bash
pwd
```

`pwd` means "print working directory". It prints the folder you are in.

## 2. The filesystem is a tree

Everything is a file or a directory (a folder). The top is `/`, called the root.

```text
/
├── home/
│   └── sani/            your home directory, also written ~
│       └── projects/
└── etc/                 system settings
```

A **path** says where something is.

| Kind | Starts with | Example | Meaning |
| :--- | :--- | :--- | :--- |
| Absolute | `/` | `/home/sani/projects` | From the root; the same from anywhere |
| Relative | a name, `.` or `..` | `projects/gpis-rebuild` | From where you are now |

`.` is the current directory. `..` is the one above it. `~` is your home.

## 3. Moving and looking

| Command | Does |
| :--- | :--- |
| `pwd` | Shows where you are |
| `ls` | Lists what is here; `ls -l` adds details; `ls -a` shows hidden names (they start with `.`) |
| `cd projects` | Goes into `projects`; `cd ..` goes up; `cd` alone goes home |
| `cat notes.txt` | Prints a file |
| `less notes.txt` | Reads a long file one screen at a time; `q` leaves |

## 4. Making, copying, moving, removing

| Command | Does |
| :--- | :--- |
| `mkdir reports` | Makes a directory; `mkdir -p a/b/c` makes the whole chain |
| `touch notes.txt` | Makes an empty file |
| `cp a.txt b.txt` | Copies; `cp -r dir1 dir2` copies a directory |
| `mv old.txt new.txt` | Renames or moves |
| `rm notes.txt` | Removes a file. **There is no recycle bin.** |
| `rmdir reports` | Removes an empty directory |

A name with a space must be quoted: `cat "term 1.txt"`. Without quotes the shell sees two
names.

## 5. Permissions

`ls -l` shows who may do what.

```text
-rw-r----- 1 sani staff 120 Nov 12 09:00 fees.csv
drwxr-xr-x 2 sani staff 4096 Nov 12 09:00 reports
```

The first character is the type: `-` file, `d` directory, `l` link. Then three groups of
three letters: for the **owner**, the **group**, and **others**.

| Letter | On a file | On a directory |
| :--- | :--- | :--- |
| `r` | read the content | list the names inside |
| `w` | change the content | add, rename or remove names inside |
| `x` | run it as a program | **enter it** and reach what is inside |

So `x` means two different things. A directory without `x` cannot be entered, even if you can
read its list of names.

Permissions are also written as numbers: `r` = 4, `w` = 2, `x` = 1, added per group.
`rw-r-----` is 6, 4, 0 → `640`.

```bash
chmod 640 fees.csv        # owner reads and writes, group reads, others nothing
chmod u+x backup.sh       # add "run" for the owner (u = user, g = group, o = others)
```

Give the least that works. `chmod 777` ("everyone may do everything") is almost never right.

## 6. Links

A **symbolic link** is a small file that points to another path, like a shortcut.

```bash
ln -s reports/2026 current     # "current" now points to reports/2026
ls -l current                  # current -> reports/2026
```

If the target is moved or removed, the link stays but points nowhere. This is a **broken
link**. `ls -l` still shows it; `cat` says "No such file or directory".

## 7. Editing in the terminal

`nano` is the simplest editor. `nano settings.conf` opens the file. The bottom lines show the
keys: `Ctrl+O` then Enter saves, `Ctrl+X` leaves. You may use another editor (vim, or
`code file` to open VS Code). The skill is "change a file where you are", not one editor's
keys.

## 8. Getting help

`ls --help` prints the options. `man ls` opens the manual (`q` leaves). Reading these is
normal work, not a sign that you do not know enough.

## Words to remember

path · absolute · relative · home (`~`) · owner, group, others · read, write, execute ·
symbolic link · broken link
