# db-sync

Add a local database using IndexedDb, user can syncronize changes telegram (Or create new implementation following ISyncClient interface)

## Dependencies

- GramJs when telegram chat is used as db

## Installation

Run in your terminal

```bash
npm i @ea-utilities/db-sync
```

## Usage (LocalDb)

```ts
export interface UserModel {
    id: string;
    name: string;
    lastName: string;
    birthday: Date;
}
```


### DB
```ts
const indexedDb = new IndexedDbClient("localDb", ["users", ...]);
indexedDb.syncAll();
```

### Collections
```ts
const usersCollection: DbInstace<UserModel> = new DbInstace(indexedDb, "users");
const filesCollection = new DbFileInstance(indexedDb);
```

### Get data
```ts
const users = await usersCollection.get();
```

### Save or update
```ts
usersCollection.addOrUpdate([...UserModel]);
usersCollection.add([...UserModel]);
usersCollection.update([...UserModel]);
```

### Delete
```ts
usersCollection.delete(UserModel.id);
```

### Listen for changes
```ts
usersCollection.subscribe(() => {
    users = await usersCollection.get();
});
```

## Usage (Telegram sync)
```ts
const telegramInstance = new TelegramSyncClient(isConnected => {
    if (isConnected) {
        indexedDb?.syncAll();
    }
});

telegramInstance.auth({
    chatName: string;
    appId: number;
    appHash: string;
    session?: string;
    phone: string;
});

const indexedDb = new IndexedDbClient("localDb", ["users", ...], telegramInstance);
indexedDb?.syncAll();
```