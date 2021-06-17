let transactions = [];
let myChart;

fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(async (data) => {
    console.log(data);
    let indexedDBdata = await getIndexedRecords();
    console.log(indexedDBdata);
    // compare data in indexeddb
    if(data.length != indexedDBdata.length){
      console.log('Incongruent data');
      indexedDBdata.forEach(idbTransaction => {
        let serverDataExists = false
        data.forEach(serverTransaction => {
          if(idbTransaction.date === serverTransaction.date){
            // data exists
            serverDataExists = true;
          }
        });
        // if data doesn't exist, add it to the server
        if(!serverDataExists){
          console.log(`Should add ${idbTransaction.date} to server`);
          // await fetch("/api/transaction", {
          //   method: "POST",
          //   body: JSON.stringify(idbTransaction),
          //   headers: {
          //     Accept: "application/json, text/plain, */*",
          //     "Content-Type": "application/json"
          //   }
          // })
        }
      });
      data.forEach(serverTransaction => {
        let localDataExists = false;
        indexedDBdata.forEach(localTransaction => {
          if(localTransaction.date === serverTransaction.date){
            // data exists
            localDataExists = true;
          }
        });
        if(!localDataExists){
          console.log(`Should add ${serverTransaction.date} to local`);
          console.log(serverTransaction);
          saveRecord(serverTransaction);
        }
      })
    }
    // refresh indexedDB data
    indexedDBdata = await getIndexedRecords();
    // then use indexed db as current data
    transactions = indexedDBdata;
    //
    // transactions.sort((firstEl, secondEl) => { 

    // })
    //transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

// save a record using indexedDB if offline
function saveRecord(tx){
  console.log(tx);
  console.log(transactions.length);
  let version = transactions.length || 1;
  const request = window.indexedDB.open('transactions', version);
  request.onupgradeneeded = event => {
    const db = event.target.result; 
    // Create an object store with a date keypath that can be used to query on.
    const transactionsStore = db.createObjectStore("transactions", {keyPath: "date"});
    //transactionsStore.createIndex("datetime", "date"); 
  }
  request.onsuccess = () => {
    const db = request.result;
    const dbTransaction = db.transaction(["transactions"], "readwrite");
    const transactionsStore = dbTransaction.objectStore("transactions");
  
    // Adds data to our objectStore
    console.log(`Adding ${tx} to indexedDB`);
    transactionsStore.add(tx);

  }
}

function getIndexedRecords(){
  let version = transactions.length || 1;
  const request = window.indexedDB.open('transactions', version);
  request.onupgradeneeded = event => {
    const db = event.target.result; 
    // Create an object store with a date keypath that can be used to query on.
    const transactionsStore = db.createObjectStore("transactions", {keyPath: "date"});
    //transactionsStore.createIndex("datetime", "date"); 
  }

  const indexPromise = new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const db = request.result;
      const dbTransaction = db.transaction(["transactions"], "readwrite");
      const transactionsStore = dbTransaction.objectStore("transactions");
      
      const getRequestIdx = transactionsStore.getAll();
      getRequestIdx.onsuccess = () => {
        console.log(getRequestIdx.result);
        //results = await getRequestIdx.result; 
         resolve(getRequestIdx.result);
        };
      getRequestIdx.onerror = () => {
        reject(getRequestIdx.error);
      }
    }
    request.onerror = () => {
      reject(request.error);
    }

  })

  return indexPromise;

}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};
