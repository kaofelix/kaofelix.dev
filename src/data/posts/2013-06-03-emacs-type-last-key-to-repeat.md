---
title: "Emacs: Type Last Key to Repeat"
pubDate: 2013-06-03T21:58:00+00:00
---

My Emacs configuration most comprises of bits I got here and there
from several different packages, blogs, githubs, etc. There's not a
whole lot of original ideas in there, but there's this one thing I
haven't seen anyone doing which I found pretty neat. The
`kmacro-end-and-call-macro` command on Emacs, normally bound to
`C-x e`, will repeatedly call the macro if you keep pressing `e`. When
I first wrote a function for duplicating a line, I wanted to bind it
to `C-c c` and be able to repeatedly press `c` after that to keep
duplicating the line without typing the whole key sequence over and
over, just like the `kmacro-end-and-call-macro` command is.

I looked at the implementation of `kmacro-end-and-call-macro` and
managed to extract the bits responsible for doing the repetition by
key. When I went to write my duplicate line function, suddenly I could
thing about a whole lot of functions that would be nicer with the same
behavior. Hence, I came up with the following elisp macro:

```common-lisp
(defmacro kao/type-last-key-to-repeat (&rest body)
  "Repeat body when typing the last key on the key sequence used
to call the enclosing command."
  (declare (indent defun))
  `(progn
     (progn ,@body)
     (let* ((repeat-key last-input-event)
            (repeat-key-str (format-kbd-macro (vector repeat-key) nil)))
       (while repeat-key
         (message "(Type %s to repeat.)" repeat-key-str)
         (if (equal repeat-key (read-event))
             (progn
               (clear-this-command-keys t)
               (progn ,@body)
               (setq last-input-event nil))
           (setq repeat-key nil)))
       (when last-input-event
         (clear-this-command-keys t)
         (setq unread-command-events (list last-input-event))))))
```

Basically, I can wrap any code I want with this and make it repeatable
by typing the last key in the key sequence of the command. My
duplicate line function ended up like this:

```common-lisp
(defun duplicate-line (times)
  "Duplicates the current line."
  (interactive "p")
  (kao/type-last-key-to-repeat
    (save-excursion
      (dotimes (ignored times)
        (end-of-line)
        (insert "\n" (replace-regexp-in-string "\n" ""
                                               (thing-at-point 'line)))))))
```

And I did some things like this:

```common-lisp
(defun repeatable-enlarge-window (size)
  "Like enlarge-window, but repeats if you keep pressing the last key in the command shortcut"
  (interactive "p")
  (kao/type-last-key-to-repeat (enlarge-window size)))
```

You should be able to apply it to any command that you want and it
should work. It's pretty neat!
