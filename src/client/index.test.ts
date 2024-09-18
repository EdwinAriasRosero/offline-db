import { IndexedDbClient, IndexedDbInstace } from "./indexedDbClient";
import { SyncDbClient } from "./syncDbClient";

const root = getElement("root");

getElement("add").onclick = () => {
    addItem();
}

getElement("update").onclick = () => {
    updateItem();
}

function getElement(id: string): any {
    return document.getElementById(id);
}

async function addItem() {
    await eaEntity.save([{ id: new Date().getTime().toString(), name: getElement("newName").value }]);
    getElement("newName").value = '';
}

async function updateItem() {
    eaEntity.update([{ id: "1", name: getElement("newName").value }]);
    getElement("newName").value = '';
}




const syncClient = new SyncDbClient('https://farm-sync-db-e61c447e43af.herokuapp.com/db');
syncClient.onConnected = async () => {
    console.log("connected");
    await localDb.syncAll();
}

const localDb = new IndexedDbClient(["ea"], syncClient);

const eaEntity = new IndexedDbInstace<any>(localDb, "ea")
eaEntity.subscribe(() => loadData())

async function loadData() {
    var data = await eaEntity.get();
    root.innerHTML = '';

    data.forEach((element: any) => {

        const li = document.createElement('li');
        li.textContent = element.name;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function () {
            eaEntity.delete(element.id);
        };
        li.appendChild(deleteButton)

        root.appendChild(li);

    });
}

loadData();