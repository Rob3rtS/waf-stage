
// create a network
var container = document.getElementById('dependencies');

var options = {
  edges: {
    style: 'arrow'
  }
};


var wafNodes;
var wafTaskGens;
var wafColors;

var nodes=[];
var edges=[];

var tgenEdgeSeen={};

loadJSON("./wafNodes.json",storeNodes);
loadJSON("./wafTaskGens.json",storeTaskGens);
loadJSON("./wafColors.json",storeColors);
//console.log(wafTaskGens);
//console.log(wafNodes);

for (var tgId in wafTaskGens) {
    nodes.push({id: tgId, label: wafTaskGens[tgId]['name'], shape: "box", color: wafColors[wafTaskGens[tgId]['colorkey']]});
    if (getNodeByTGen(tgId) in wafNodes) {
    parents=wafNodes[getNodeByTGen(tgId)]['parents'];
    console.log(wafTaskGens[tgId]['name']);
    console.log(parents);
    parents.map(function(p) {
        parentId=wafNodes[p]['tgen'];
        combi=parentId+'_'+tgId;
        console.log(wafNodes[p]);
        console.log(p+' '+combi);
        // make sure to add the edge between 2 task gens only once
        if (parentId !== tgId) {
        //if (! combi in tgenEdgeSeen && parentId !== tgId) {
            tgenEdgeSeen[combi]=true;
            edges.push({from: tgId, to: parentId});
        }
    })
    }
}

var data = {
    nodes: nodes,
    edges: edges
};
var container = document.getElementById('dependencies');
var network = new vis.Network(container, data, options);

function getNodeByTGen(id) {
    for (var ndId in wafNodes) {
        if (id === wafNodes[ndId]['tgen']) {
            return ndId;
        }
    }
}

function storeNodes(wafNodesJSON) {
    wafNodes=wafNodesJSON
}
function storeTaskGens(wafTaskGensJSON) {
    wafTaskGens=wafTaskGensJSON
}
function storeColors(wafColorsJSON) {
    wafColors=wafColorsJSON
}

function loadJSON(path, success, error) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                success(JSON.parse(xhr.responseText));
            }
            else {
                error(xhr);
            }
        }
    };
    // for now, use synchronous request: false
    xhr.open("GET", path, false);
    xhr.send();
}