
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

for (var ndId in wafNodes) {
    if (wafNodes[ndId]['visible'] == 'false') {
        // this node is output of the following task gens:
        //var outOfTGen=getTGenOutOf(ndId);
        // this node is input for the following task gens:
        var inForTGens=wafNodes[ndId]['in_for_tgen'];
        // connect all task gens with edges, where this node is input for one and output of another
        var outTgId=wafNodes[ndId]['out_of_tgen'];
        if (inForTGens) {
            inForTGens.map(function(n) {
                // show the task gen
                //wafTaskGens[n]['visible']='true'; // should be visible anyway by default
                if (n == undefined || outTgId == undefined) {
                    return;
                }
                combi=outTgId+'_'+n;
                console.log(wafNodes[ndId]['name']+': '+combi);
                if (n == outTgId) {
                    console.log('skipping edge: '+outTgId+' == '+n);
                    return;
                }
                // make sure to add the edge between 2 task gens only once
                if (! (combi in tgenEdgeSeen) && n != outTgId) {
                    tgenEdgeSeen[combi]=1;
                    edges.push({from: outTgId, to: n});
                }
            })
        }
    }
    else {
        // this node shall be visible - can it be connected directly to its parent node or to the task gen, for which the parent is an output?
        var parents=wafNodes[ndId]['parents'];
        parents.map(function(p) {
                if (wafNodes[p]['visible'] == 'true') {
                    edges.push({from: ndId, to: p});
                }
                else {
                    var outTgId=wafNodes[p]['out_of_tgen'];
                    if (outTgId == undefined) {
                        return;
                    }
                    combi=ndId+'_'+outTgId;
                    console.log(wafNodes[ndId]['name']+': '+combi);
                    if (ndId == outTgId) {
                        console.log('skipping edge: '+ndId+' == '+outTgId);
                        return;
                    }
                    // make sure to add the edge between 2 task gens only once
                    if (! (combi in tgenEdgeSeen) && ndId != outTgId) {
                        tgenEdgeSeen[combi]=1;
                        edges.push({from: ndId, to: outTgId});
                    }
                }
            }
        )
    }
}

// add nodes for all visible elements
for (var ndId in wafNodes) {
    if (wafNodes[ndId]['visible'] == 'true') {
        console.log(wafNodes[ndId]['name']+': '+wafNodes[ndId]['visible']);
        nodes.push({id: ndId, label: wafNodes[ndId]['name'], shape: "box", color: wafColors[wafNodes[ndId]['colorkey']]});
    }
}
for (var tgId in wafTaskGens) {
    if (wafTaskGens[tgId]['visible'] == 'true') {
        console.log(wafTaskGens[tgId]['name']+': '+wafTaskGens[tgId]['visible']);
        nodes.push({id: tgId, label: wafTaskGens[tgId]['name'], shape: "box", color: wafColors[wafTaskGens[tgId]['colorkey']]});
    }
}

//~ for (var tgId in wafTaskGens) {
    //~ if (wafTaskGens[tgId]['visible'] == 'true') {
        //~ console.log(wafTaskGens[tgId]['name']+': '+wafTaskGens[tgId]['visible']);
        //~ nodes.push({id: tgId, label: wafTaskGens[tgId]['name'], shape: "box", color: wafColors[wafTaskGens[tgId]['colorkey']]});
        //~ var tgnodes=getNodesForTGen(tgId);
        //~ tgnodes.map(function(n) {
            //~ if (n in wafNodes) {
                //~ var parents=wafNodes[n]['parents'];
                //~ console.log('nd: '+wafNodes[n]['name']+' tg: '+wafTaskGens[tgId]['name']);
                //~ console.log(parents.map(function(i){return wafNodes[i]['name'];}));
                //~ parents.map(function(p) {
                    //~ parentId=wafNodes[p]['tgen'];
                    //~ if (wafTaskGens[parentId]['visible'] === 'false') {
                        //~ // task gen is exploded, link this task gen to its parent task gen's nodes
                        
                    //~ }
                    //~ combi=parentId+'_'+tgId;
                    //~ console.log(wafNodes[p]);
                    //~ console.log(wafNodes[p]['name']+': '+combi);
                    //~ // make sure to add the edge between 2 task gens only once
                    //~ if (! (combi in tgenEdgeSeen) && parentId !== tgId) {
                        //~ tgenEdgeSeen[combi]=1;
                        //~ edges.push({from: tgId, to: parentId});
                    //~ }
                //~ })
            //~ }
        //~ })
    //~ }
//~ }

var data = {
    nodes: nodes,
    edges: edges
};
var container = document.getElementById('dependencies');
var network = new vis.Network(container, data, options);

function getTGensInFor(id) {
    var result=[];
    for (var ndId in wafNodes) {
        if (id === wafNodes[ndId]['in_for_tgen']) {
            result.push(ndId);
        }
    }
    return result;
}
//~ function getNodesForTGen(id) {
    //~ var result=[];
    //~ for (var ndId in wafNodes) {
        //~ if (id === wafNodes[ndId]['in_for_tgen']) {
            //~ result.push(ndId);
        //~ }
    //~ }
    //~ return result;
//~ }

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