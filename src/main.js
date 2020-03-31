// Sonant-X-Play
//
// A tiny and fast player for sonant-x songs.
//
// I wanted something for casual browsing and listening of various
// sonant-x compositions.  Sonant-X-Live is brilliant for creating
// and editing, but when browsing lots of different songs it becomes
// quite cumbersome.  This player attempts to address this.

(async function load() {
  let canvas_el = null,
    play_el = null,
    message_el = null,
    time_el = null,
    edit_el = null;

  const EDIT_URL = 'https://nicolas-van.github.io/sonant-x-live/';

  let audio = null,
    song = null,
    buffer = null,
    source = null;

  let analyser = null,
    analyserDataLength = 1,
    analyserData = [];

  let is_playing = false;

  function set_message(content) {
    if (content && content.length > 0) {
      message_el.innerText = content;
    }
  }

  function set_time(content) {
    if (content && content.length > 0) {
      time_el.innerText = content;
    }
  }

  function on_hash_changed() {
    stop_song();
    load_song();
  }

  function on_play_pause() {
    if (is_playing) {
      stop_song();
    } else {
      play_song();
    }
  }

  // prevent default drag
  function on_drag_over(e) {
    e.preventDefault();
  }

  function on_drop(e) {
    e.preventDefault();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      let reader = new FileReader();
      reader.onloadend = function () {
        let song = JSON.parse(this.result);
        if (song && song.songLen > 0 && song.songData.length > 0) {
          encode_song(song);
        } else {
          set_message('drop failed.');
          // process instrument json files?
        }
      };

      reader.readAsText(event.dataTransfer.files[0]);
    }
  }

  function encode_song(song) {
    let escapeForDumbFirefox36 = function (value) {
      // https://github.com/medialize/URI.js/issues/91
      return escape(value);
    };

    let encodeURIComponentStrict = function (string) {
      return encodeURIComponent(string)
        .replace(/[!'()*]/g, escapeForDumbFirefox36)
        .replace(/\*/g, '%2A');
    };

    let json = JSON.stringify(song);
    let fragment = encodeURIComponentStrict(LZString.compressToBase64(json));
    location.hash = '#' + fragment;
  }

  function decode_song() {
    let fragment = null,
      json = null,
      song = null;

    fragment = location.hash.length ? location.hash.substring(1) : '';

    if (fragment) {
      json = LZString.decompressFromBase64(decodeURIComponent(fragment));
    }
    if (json) {
      song = JSON.parse(json);
    }
    return song;
  }

  function pad(str, max) {
    str = str.toString();
    return str.length < max ? pad('0' + str, max) : str;
  }

  function format_time(seconds) {
    seconds = Number(seconds);
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds % 60);
    let mstr = m >= 0 ? pad(m, 2) : '';
    let sstr = s >= 0 ? pad(s, 2) : '';
    return mstr + ':' + sstr;
  }

  function load_song() {
    set_message('Loading song...');
    set_time(`${format_time(0)}`);

    setTimeout(function () {
      song = decode_song();
      if (!song) {
        set_message('no song');
        set_time(`${format_time(0)}`);
        return;
      }

      // reset edit location when decode succeeds
      edit_el.href = EDIT_URL + location.hash;

      let t0 = new Date();
      buffer = audio_create_song(song);
      let t1 = new Date();
      set_message(`Generation time: ${t1 - t0}ms`);
      set_time(`${format_time(0)} / ${format_time(song.songLen)}`);

      analyser.fftSize = 256;
      analyserDataLength = analyser.frequencyBinCount;
      analyserData = new Uint8Array(analyserDataLength);
    }, 16);
  }

  function play_song() {
    if (is_playing) {
      return;
    }

    if (!song) {
      return;
    }

    // clunky - ensure a fresh audio ctx
    audio = audio_init();
    audio.resume();
    analyser = audio.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.86;

    source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(audio.destination);
    source.start(0);

    is_playing = true;
    play_el.className = 'button stop';
  }

  function stop_song() {
    if (is_playing) {
      source.stop();
      audio.close();
    }

    is_playing = false;

    if (song && song.songLen) {
      set_time(`${format_time(0)} / ${format_time(song.songLen)}`);
    } else {
      set_time(`${format_time(0)}`);
    }
    play_el.className = 'button play';
  }

  function check_song() {
    if (is_playing) {
      set_time(
        `${format_time(audio.currentTime)} / ${format_time(song.songLen)}`
      );

      if (audio.currentTime > buffer.duration) {
        stop_song();
      }
    }
  }

  function onload() {
    canvas_el = document.getElementById('canvas');
    play_el = document.getElementById('play');
    message_el = document.getElementById('message');
    time_el = document.getElementById('time');
    edit_el = document.getElementById('edit');

    play_el.addEventListener('click', on_play_pause);
    window.addEventListener('hashchange', on_hash_changed);

    // addEventListener?
    document.body.ondragover = on_drag_over;
    document.body.ondrop = on_drop;

    // init audio & analyser
    audio = audio_init();
    analyser = audio.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.86;

    let ctx = canvas.getContext('2d');
    let width = canvas.width,
      height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgb(58,58,58)';
    ctx.fillRect(0, 0, width, height);

    load_song();

    setInterval(function () {
      check_song();

      ctx.fillStyle = 'rgb(58,58,58)';
      ctx.fillRect(0, 0, width, height);

      if (!is_playing) {
        return;
      }

      analyser.getByteFrequencyData(analyserData);
      let barWidth = width / analyserDataLength;
      let barHeight;
      let x = 0;
      let color = 0;

      for (let i = 0; i < analyserDataLength; i++) {
        barHeight = analyserData[i];

        color = barHeight + 100;
        ctx.fillStyle = `rgb(${color},${color},${color})`;
        ctx.fillRect(x, height - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    }, 16);
  }

  onload();
})();
