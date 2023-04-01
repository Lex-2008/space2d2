import { Direction } from "./angle.js";
import { draw_star } from "./draw.js";
import { flightplan, redrawFlightplan } from "./flightplan.js";
import { setupHints, set_shown_star, shown_star } from "./hints.js";
import { Star } from "./stars.js";
import { check, default_universe, loadUniverse, moveToNewStar, player_star, saveUniverse, set_player_star, stats } from "./universe.js";

export function gebi(id: string) {
    const element = document.getElementById(id);
    if (!element) throw ReferenceError(`element ${id} not found`);
    return element;
}

export var mode: string;

var c: HTMLCanvasElement;
var ctx: CanvasRenderingContext2D;

export function redraw() {
    draw_star(ctx, shown_star);
    setupHints(shown_star, c, gebi('hints'));
    redrawFlightplan();
    document.getElementById('mapTitle_player').style.display = (shown_star == player_star) ? '' : 'none';
    document.getElementById('mapTitle_neighbour').style.display = (shown_star == player_star) ? 'none' : '';
    if (shown_star != player_star) {
        document.getElementById('mapTitle_neighbour_n').innerText = player_star.neighbours.indexOf(shown_star) + 1;
        document.getElementById('mapTitle_neighbour_total').innerText = player_star.neighbours.count;
    }
    document.getElementById('stats_s').innerText = stats.s;
    document.getElementById('stats_p').innerText = stats.p;
    document.getElementById('stats_js').innerText = stats.js;
    document.getElementById('stats_jf').innerText = stats.jf;
    document.getElementById('stats_jf_s').innerText = Math.round(stats.jf / stats.s * 100) / 100;
    document.getElementById('stats_jf_p').innerText = Math.round(stats.jf / stats.p * 100);
    document.getElementById('stats_jf_js').innerText = Math.round(stats.jf / stats.js * 100);
    // document.getElementById('stats_mr').innerText=stats.mr;
    // document.getElementById('stats_mrc').innerText=stats.mrc;
    // document.getElementById('stats_mrc_show').style.display=stats.mrc>1?'':'none';
}

window.onhashchange = function () {
    if (['#test', '#easy', '#hard'].indexOf(location.hash) > -1) {
        mode = location.hash.slice(1);
        console.log(mode);
    } else {
        history.replaceState(0, '', location.pathname);
        (gebi('select_mode') as HTMLDialogElement).showModal();
        return;
    }

    c = document.getElementById("myCanvas") as HTMLCanvasElement;
    ctx = c.getContext("2d") as CanvasRenderingContext2D;

    if (mode == 'test') loadUniverse(JSON.parse(default_universe));
    else loadUniverse(JSON.parse(localStorage['space2d2' + mode] || default_universe));

    if (!check()) alert('universe error, check console');

    set_shown_star(player_star);

    redraw();
}

window.onhashchange();

export function jump() {
    if (shown_star == player_star) return;
    if (shown_star.visited) return;
    stats.s++;
    stats.p += flightplan.steps.length - 1;
    stats.jf += flightplan.countJobs();
    stats.js += player_star.jobs;
    const ratio = Math.round(flightplan.countJobs() / player_star.jobs * 100);
    // if(ratio>stats.mr){
    // 	stats.mr=ratio;
    // 	stats.mrc=1;
    // }else if(ratio==stats.mr){
    // 	stats.mrc++;
    // }
    console.clear();
    moveToNewStar(shown_star, player_star);
    var lastCargo = flightplan.lastStep.cargo;
    var direction = shown_star.neighbours.directionOf(player_star);
    flightplan.init(direction.x, direction.y, lastCargo, document.getElementById('myFlightplan') as HTMLDivElement);
    player_star.visited = true;
    set_player_star(shown_star);
    localStorage['space2d2' + mode] = JSON.stringify(saveUniverse());
    // location.reload();
    redraw();
    if (!check()) alert('universe error, check console');
}

window.jump = jump;
window.redraw = redraw;
window.flightplan = flightplan;
window.redrawFlightplan = redrawFlightplan;
window.set_shown_star = set_shown_star;
window.get_shown_star = () => shown_star;
window.player_star = player_star;

if (location.hostname == 'localhost') {
    new EventSource('/esbuild').addEventListener('change', () => location.reload());
}