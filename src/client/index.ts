import { LocalDbClient } from "./localDbClient";
import { SyncDbClient } from "./syncDbClient";

const root = getElement("root");

getElement("add").onclick = () => {
    addItem();
}

getElement("update").onclick = () => {
    updateItem();
}

const syncClient = new SyncDbClient('http://localhost:3000/db');
syncClient.onConnected = async () => {
    await localDb.sync('ea');
    loadData("ea");
}

const localDb = new LocalDbClient(syncClient);

localDb.onUpdated = () => {
    loadData("ea");
}

function getElement(id: string): any {
    return document.getElementById(id);
}

async function addItem() {
    await localDb.save("ea", [{ id: new Date().getTime(), name: getElement("newName").value }]);
    getElement("newName").value = '';
}

async function updateItem() {
    await localDb.update("ea", [{ id: 1, name: getElement("newName").value }]);
    getElement("newName").value = '';
}

async function loadData(type: string) {
    var data = await localDb.get("ea");
    root.innerHTML = '';

    data.forEach((element: any) => {

        const li = document.createElement('li');
        li.textContent = element.name;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function () {
            localDb.delete('ea', element.id);
        };
        li.appendChild(deleteButton)

        root.appendChild(li);

    });
}

loadData("ea");