// waf - Build Dependency Visualization using vis.js

// create a network
var container = document.getElementById('dependencies');

var options = {
    physics: {
        stabilization: false
    },
    edges:{smooth:{type:'continuous'}},
    width: '100%',
    height: '100%',
    autoResize: true,
    edges: {
        arrows: 'to',
        smooth: {type:'continuous'}
    }
};

var wafNodes;
var wafTaskGens;
var wafColors;
var keyRecursive=false;
var limit=100;
var timeout=100; // [ms]
var rootIsExploded=false;
var edgeCache=[];

// trying to load .json files from any directory other than the current or a subdirectory fails due to a browser security policy
loadJSON("./wafNodes.json",storeNodes);
loadJSON("./wafTaskGens.json",storeTaskGens);
loadJSON("./wafColors.json",storeColors);
var container = document.getElementById('dependencies');
var nodes = new vis.DataSet();
var edges = new vis.DataSet();
var data = {
    nodes: nodes,
    edges: edges
};
var network = new vis.Network(container, data, options);
network.fit();

function nodesUpdate(i, l, s, c) {
    nodes.update({id: i, label: l, shape: s, color: c});
}

function edgesUpdate(i, f, t) {
    edges.update({id: i, from: f, to: t});
}

function calcVis() {
    // add nodes for all visible elements
    for (var ndId in wafNodes) {
        if (wafNodes[ndId]['visible'] == 'true') {
            setTimeout(function(i, l, s, c) {nodesUpdate(i, l, s, c)}(ndId, wafNodes[ndId]['name'], "box", wafColors[wafNodes[ndId]['colorkey']]), timeout);
        }
        else {
            nodes.remove(ndId);
            edges.forEach(function(e) {
                if (e.from == ndId || e.to == ndId) {
                    edges.remove(e.id);
                    delete edgeCache[e.id];
                }
            });
        }
    }
    for (var tgId in wafTaskGens) {
        if (wafTaskGens[tgId]['visible'] == 'true') {
            setTimeout(function(i, l, s, c) {nodesUpdate(i, l, s, c)}(tgId, wafTaskGens[tgId]['name'], "ellipse", wafColors[wafTaskGens[tgId]['colorkey']]), timeout);
        }
        else {
            nodes.remove(tgId);
            edges.map(function(e) {
                if (e.from == tgId || e.to == tgId) {
                    edges.remove(e.id);
                    delete edgeCache[e.id];
                }
            });
        }
    }
    for (var ndId in wafNodes) {
        if (wafNodes[ndId]['visible'] == 'false') {
            // this node is input for the following task gens:
            var inForTGens=wafNodes[ndId]['in_for_tgen'];
            // connect all task gens with edges, where this node is input for one and output of another
            var outTgId=wafNodes[ndId]['out_of_tgen'];
            if (outTgId in wafTaskGens && wafTaskGens[outTgId]['visible'] == 'false') {
                continue;
            }
            if (inForTGens) {
                for (var i=0; i<inForTGens.length; i++) {
                    var n=inForTGens[i];
                    // show the task gen
                    if (n == undefined || outTgId == undefined) {
                        break;
                    }
                    if (wafTaskGens[n]['visible'] == 'true') {
                        var combi=outTgId+'_'+n;
                        if (n != outTgId) {
                            // edges.update() makes sure to add the edge between 2 task gens only once
                            if (!(combi in edgeCache)) {
                                setTimeout(function(i, f, t) {edgesUpdate(i, f, t) }(combi, outTgId, n), timeout);
                                edgeCache[combi]=1;
                            }
                        }
                    }
                    else {
                        // create edges between from this task gen to the nodes of the exploded task gen
                        var relatedNodes=getNodesInForAnyOutOfTGen(n);
                        for (var i=0; i<relatedNodes.length; i++) {
                            var m=relatedNodes[i];
                            var combi=outTgId+'_'+m;
                            if (m != outTgId) {
                                if (!(combi in edgeCache)) {
                                    setTimeout(function(i, f, t) {edgesUpdate(i, f, t) }(combi, outTgId, m), timeout);
                                    edgeCache[combi]=1;
                                }
                            }
                        }
                    }
                }
            }
        }
        else {
            // this node shall be visible - can it be connected directly to its parent node or to the task gen, for which the parent is an output?
            var parents=wafNodes[ndId]['parents'];
            for (var i=0; i<parents.length; i++) {
                var p=parents[i];
                if (wafNodes[p]['visible'] == 'true') {
                    var combi=ndId+'_'+p;
                    if (!(combi in edgeCache)) {
                        setTimeout(function(i, f, t) {edgesUpdate(i, f, t) }(combi, ndId, p), timeout);
                        edgeCache[combi]=1;
                    }
                }
                else {
                    var outTgId=wafNodes[p]['out_of_tgen'];
                    if (outTgId == undefined) {
                        break;
                    }
                    var combi=ndId+'_'+outTgId;
                    if (ndId == outTgId) {
                        break;
                    }
                    // make sure to add the edge between 2 task gens only once
                    if (ndId != outTgId) {
                        if (!(combi in edgeCache)) {
                            setTimeout(function(i, f, t) {edgesUpdate(i, f, t) }(combi, ndId, outTgId), timeout);
                            edgeCache[combi]=1;
                        }
                    }
                }
            }
        }
    }
}


function calcVisAll() {
    var ndCache=[];
    for (var ndId in wafNodes) {
        if (wafNodes[ndId]['visible'] == 'true') {
            if (!(ndId in ndCache)) {
                setTimeout(function(i, l, s, c) {nodesUpdate(i, l, s, c)}(ndId, wafNodes[ndId]['name'], "box", wafColors[wafNodes[ndId]['colorkey']]), timeout);
                ndCache[ndId]=1;
            }
            var parents=wafNodes[ndId]['parents'];
            for (var i=0; i<parents.length; i++) {
                var p=parents[i];
                if (wafNodes[p]['visible'] == 'true') {
                    var combi=ndId+'_'+p;
                    if (!(p in ndCache)) {
                        setTimeout(function(i, l, s, c) {nodesUpdate(i, l, s, c)}(p, wafNodes[p]['name'], "box", wafColors[wafNodes[p]['colorkey']]), timeout);
                        ndCache[p]=1;
                    }
                    if (!(combi in edgeCache)) {
                        setTimeout(function(i, f, t) {edgesUpdate(i, f, t) }(combi, ndId, p), timeout);
                        edgeCache[combi]=1;
                    }
                }
            }
        }
    }
}

network.on('doubleClick', function(params) {
    explode(params.nodes[0]);
});

function explode(id){
    if (id == 'rootTG') {
        if (rootIsExploded == true) { return; }
        var children=getChildTGens(id);
        for (var i=0; i<children.length; i++) {
             showTGen(children[i]);
        }
        rootIsExploded=true;
    }
    else if (id in wafTaskGens) {
        wafTaskGens[id]['visible']='false';
        var relatedNodes=[];
        if (keyRecursive == true) {
            relatedNodes=getRelatedNodesForTGen(id);
            // find all task gens, which are putting out any nodes, which are input for this task gen
            var relatedTGens=getChildTGens(id);
            for (var i=0; i<relatedTGens.length; i++) {
                if (wafTaskGens[relatedTGens[i]]['visible'] == 'true') {
                    explode(relatedTGens[i]);
                }
            }
        }
        else {
            relatedNodes=getNodesOutOfTGen(id);
        }
        for (var i=0; i<relatedNodes.length; i++) {
            showNode(relatedNodes[i]);
        }
    }
    else if (id in wafNodes) {
        var relatedNodes=wafNodes[id]['children'];
        relatedNodes.map(function(n){
            showNode(n);
        });
    }
    calcVis();
}

function showTGen(n) {
    wafTaskGens[n]['visible']='true';
}

function showNode(n) {
    wafNodes[n]['visible']='true';
}

function explodeAll() {
    var no=Object.keys(wafNodes).length;
    if (no > limit) {
        var proceed=confirm('Number of visible node '+no+' exceeds limit: '+limit+'.\nProceed anyway?');
        if (! proceed) { return; }
    }
    for (var n in wafNodes) {
        showNode(n);
    }
    for (var t in wafTaskGens) {
        wafTaskGens[t]['visible']='false'
    }
    calcVisAll();
}

function countItems() {
    var count=0;
    for (var ndId in wafNodes) {
        if (wafNodes[ndId]['visible'] == 'true') {
            count++;
        }
    }
    for (var tgId in wafTaskGens) {
        if (wafTaskGens[tgId]['visible'] == 'true') {
            count++;
        }
    }
    return count;
}

function init() {
    calcVis();
    explode('rootTG');
    // when Ctrl-key is pressed during doubleclick: explode the task gen "recursively"
    window.onkeydown = function(e){
        if (e.keyCode == 17) {
            keyRecursive=true;
        }
    };
    window.onkeyup = function(e){
        if (e.keyCode == 17) {
            keyRecursive=false;
        }
    };
    document.getElementById('explode_all').onclick=explodeAll;
}
window.onload=init;

// get all nodes, which are input for OR output of a task gen
function getRelatedNodesForTGen(n) {
    return wafTaskGens[n]['out_nodes'].concat(wafTaskGens[n]['in_nodes']);
}

// get all nodes, which are output of a task gen
function getNodesOutOfTGen(n) {
    return wafTaskGens[n]['out_nodes'];
}

// get all nodes, which are input for a task gen
function getNodesInForTGen(n) {
    return wafTaskGens[n]['in_nodes'];
}

// get all output-nodes of a task gen, which are input for any other task gen
function getNodesInForAnyOutOfTGen(n) {
    var relatedNodes=[];
    for (var i in wafTaskGens[n]['out_nodes']) {
        var o=wafTaskGens[n]['out_nodes'][i];
            var f=false;
            for (var m in wafTaskGens) {
                if (Array.isArray(wafTaskGens[m]['in_nodes']) && wafTaskGens[m]['in_nodes'].indexOf(o) > -1 && n != m) {
                    f=true;
                    break;
                }
            }
            if (f) {
                relatedNodes.push(o);
            }
    }
    return relatedNodes;
}

function getChildTGens(t) {
    var children=[];
    getNodesInForTGen(t).map(function(o) {
        if (o in wafNodes) {
            for (var m in wafTaskGens) {
                if (getNodesOutOfTGen(m).indexOf(o) > -1) {
                    children.push(m);
                }
            }
        }
    });
    return children;
}

function storeNodes(wafNodesJSON) {
    wafNodes=wafNodesJSON;
}

function storeTaskGens(wafTaskGensJSON) {
    wafTaskGens=wafTaskGensJSON;
}

function storeColors(wafColorsJSON) {
    wafColors=wafColorsJSON;
}

function loadJSON(path, success, error) {
    console.time('loadJSON');
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
    console.timeEnd('loadJSON');
    xhr.send();
}
