---
title: "Using Github with Multiple Accounts"
tags: ["git", "shell", "workflow", "emacs"]
pubDate: 2019-04-08T22:03:16+02:00
---

At my current project, I need to use a different Github account from
my personal one. To improve my workflow, I had to find a way to easily
switch between both accounts. I explored a few options until settling
with, in my opinion, the most convenient solution.

The base for every solution I found was how to select between two
different SSH keys associated with the different accounts.

Let's pretend I'm working for client _Foo_. Right now, on my work
laptop, I have two SSH keys:

- `~/.ssh/id_rsa`: my own private key
- `~/.ssh/id_rsa_foo`: the private key I generated for _Foo_'s repos
  in their enterprise Github

The problem is, given a cloned repo I'm working on, how do I make sure
I'm using the correct key whether it is a personal repo or a work
repo.

For any solution to work well, you might need to run

```shell
ssh-add  ~/.ssh/id_rsa
```

and

```shell
ssh-add ~/.ssh/id_rsa_foo
```

to have both keys in your SSH agent.

# First Solution: Custom Host Name in SSH Config

One of the first solutions I came across a while ago, was adding a
block in my `~/.ssh/config` with a host alias for Github.com
associating a different identity file with it. For example, adding

```
Host foo
    HostName github.com
    User kaoatfoo
    IdentityFile ~/.ssh/id_rsa_foo
```

to my SSH config, will make it so that I can replace
`git@github.com:foo-corp/some-foo-repo.git` with
`git@foo:foo-corp/some-foo-repo.git` to select the correct identity
when working at a _Foo_ repository. This solution is mostly fine and
you could go it the other way around and create an alias for your
personal repos instead, if it's more convenient for you.

In my case, I want to alias my work repos because I want my personal
Github experience to be as friction-less as possible. However, I faced
an issue.

In my project, we work with Terraform and use modules stored in
private repos in the _Foo_ enterprise account. If I want to apply some
of this code locally, Terraform cannot access the modules because the
host name in the Terraform code is _not_ aliased:

```tf
module "bar_service" {
    source = "git@github.com:foo-corp/service.git"

    ...
}
```

Of course using a host name alias in the code would require every team
member to share the exact same SSH config, which adds extra friction
for every team member and I definitely don't want that just to cater
for my own personal setup.

That kept me looking for a better solution.

# Second Solution: The GIT_SSH_COMMAND Environment Variable

After some googling around, I came across the
[`GIT_SSH_COMMAND`](https://git-scm.com/docs/git#Documentation/git.txt-codeGITSSHCOMMANDcode)
environment variable. This allows you to customize the command Git
uses for executing SSH and it is particularly handy because you can use

```shell
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_rsa_foo'
```

to tell Git to use your work identity in a given shell. The first way
I used this, was creating a `fgit` (as in _Foo_ Git) alias in my shell

```shell
alias fgit="GIT_SSH_COMMAND='ssh -i ~/.ssh/id_rsa_foo'"
```

so I could run `fgit commit`, `fgit push`, etc when working on a _Foo_
repo. This was reasonable, but still had the limitation with Terraform
modules, since Terraform is not aware of my `fgit` alias. For that
reason, I ended up creating toggle aliases

```shell
alias fgit-on="export GIT_SSH_COMMAND='ssh -i ~/.ssh/id_rsa_foo'"
alias fgit-off="unset GIT_SSH_COMMAND"
```

I also added a check for the environment variable in my shell prompt
that would print something like `[foo-git-on]` in red so I would
have a visual reminder that I had this on or off.

This has proven to be quite OK. I would forget to toggle it on
occasionally, but the access denied error in git was a reliable
reminder.

I still longed for a more convenient setup, though, and ended up
stumbling upon a tool that helped me solve this.

# Current Solution: Environment Variables and direnv

I stumbled upon [direnv](https://direnv.net) at some point and it
became apparent on how it could help me with my env var setup for
different Git identities.

## How direnv works

Once you hook it up into your shell, direnv will look for a `.envrc`
file at the current and parent directories of any directory you visit
in your shell.

When it first encounters a new `.direnv` file, it won't execute it
before you `direnv allow` it. This is to make sure you check the file
contents beforehand, since `.envrc` files can execute arbitrary shell
code, not just exporting environment variables. It keeps track of the
hash of the file too, so If the content changes you need to allow it
again.

After being allowed, direnv will execute a `.envrc` present in the
current directory hierarchy, keeping track of environment changes done
along the way, and reverting them back when you navigate away from
the hierarchy where your `.envrc` is present.

## My setup

All my _Foo_ repos like in a folder like `~/Work/Foo/` in my work
laptop. I created a `.envrc` file at this folder with the environment
variable I was using on my aliases.

```shell
export GIT_SSH_COMMAND='ssh -i ~/.ssh/id_rsa_foo'
```

At some point I also realized I overlooked another aspect of my setup
which was the author email in my commits. Github associates a user
account with a commit based on the primary email of that account
matching the author email on the commit.

Since I had my personal email on my global `gitconfig`, that meant some
commits I made at _Foo_ showed up associated with my personal Github
account on the history in Github, instead of my work account. Oops...

The solution for that was adding the
[GIT_AUTHOR_EMAIL](https://git-scm.com/docs/git#Documentation/git.txt-codeGITAUTHOREMAILcode)
and
[GIT_COMMITER_EMAIL](https://git-scm.com/docs/git#Documentation/git.txt-codeGITCOMMITTEREMAILcode)
environment variable to my `.envrc`, making it look like

```shell
export GIT_SSH_COMMAND='ssh -i ~/.ssh/id_rsa_foo'
export GIT_AUTHOR_EMAIL='workusername@workdomain.com'
export GIT_COMMITTER_EMAIL='workusername@workdomain.com'
```

I also use a [direnv package for
Emacs](https://github.com/wbolster/emacs-direnv), which enables me to
run Git and Terraform and also means that [Magit](https://magit.vc)
works seamlessly for both work and personal repos.

So far I'm quite happy with my setup. The only tool that I rely on and
that is not well integrated with this setup is IntelliJ. I couldn't
find a direnv plugin for IntelliJ, but I did come across a [possible
solution using a different
plugin](https://medium.com/@tmaslen/keeping-environment-variables-local-to-a-project-directory-on-the-terminal-and-with-intellij-c928c2016599).
I haven't tested it yet, though, since I don't use IntelliJ to run Git
commands anyway and I have been using Emacs for editing Terraform as
well.
