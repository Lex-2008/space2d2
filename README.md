space2d2
========

A space trading game without money.

Play it online here: <https://space2d2.shpakovsky.ru/>

Alternatively, clone this repo and open `index.html` -
this way, only "easy" and "hard" modes will work.
Actually, you only need `index.html` and `script.js` files.

Development
-----------

To start a dev server, run:

    esbuild --bundle ./src/index.js --outfile=script.js --sourcemap --external:../pocketbase/* --watch --servedir=.

and open http://localhost:8000/

To test Real mode, you additionally need a [pocketbase][pb] server with proper DB schema (see below). Run it like this:

    ./pocketbase serve

It serves at http://127.0.0.1:8090, which this game will use if opened from `localhost`.

To produce a ready-to-be-shipped `script.js` file, run:

    esbuild --bundle ./src/index.js --outfile=script.js --sourcemap --external:../pocketbase/* --minify

[pb]: https://pocketbase.io/

DB schema
---------

In PocketBase, create collection, type: Base, call it `real`. With two fields:

* `user` - type: relation, Nonempty, Delete main record on relation delete.

* `data` - type: JSON, Nonempty.

And with unique inded on "user" field.

Then create another collection, type: View, name: `real_update`, and the following Select query:

    SELECT id FROM real where datetime(updated, '10 hours') < DATETIME();

Then go back to your `real` collection, and change its API rules:

* List/Search and View rules are the same:

      @request.auth.id = user

* Create rule is:

      @request.auth.id = @request.data.user

* Update rule is:

      @request.auth.id = user && @collection.real_update.id ?= id

These rules ensure that only user themselves can view, create, and update their savegame (stored in the collection called `real`).
Moreover, update is possible only 10 hours after last update.