'use strict';

// define a couple global helper methods to get rid of some boilerplate

/**
 * wrapper around document.querySelector
 * @param selector
 * @returns {Element}
 */
function $(selector) {
    return document.querySelector(selector);
}

/**
 * return array of all elements returned by document.querySelectorAll
 * @param selector
 * @returns {Array}
 */
function $$(selector) {
    var elements = {
        nodeList: document.querySelectorAll(selector),
        arr: []
    };

    for (var i = 0; i < elements.nodeList.length; i++) {
        elements.arr.push(elements.nodeList[i]);
    }

    return elements.arr;
}

function noop() {}

HTMLElement.prototype.on = HTMLElement.prototype.addEventListener;

var ibm = window.ibm || {};
ibm = {
    flickr: {
        baseUrl: 'https://api.flickr.com/services/rest/',
        options: {
            method: 'flickr.people.getPublicPhotos',
            api_key: 'a5e95177da353f58113fd60296e1d250',
            user_id: '24662369@N07',
            format: 'json',
            nojsoncallback: 1,
            extras: 'date_upload,date_taken,geo,views'
        },

        getEndpoint: function () {
            return this.baseUrl + '?' + ibm.utils.toQueryString(this.options);
        }
    },

    init: function () {
        this.getPhotos();
        this.streamControls();




        $$('.cycle-photo').forEach(function (el) {
            el.on('click', function () {
                var maxIndex = $$('.photo-wrapper').length - 1;
                var currentIndex = parseInt($('.active-controls').dataset.index, 10);
                var delta = parseInt(this.dataset.delta, 10);

                var nextIndex = (currentIndex + delta) % maxIndex;
                if (nextIndex < 0)
                    nextIndex = maxIndex;

                var nextWrapper = $('.photo-wrapper[data-index="' + nextIndex + '"]');

                ibm.makePhotoActive(nextWrapper);
            }, false);
        });

        $('#close-active').on('click', function () {
            $('#active-container').style.display = 'none';
            ibm.utils.removeClassAll('active-wrapper');
        }, false);
    },

    getPhotos: function () {
        var endpoint = this.flickr.getEndpoint();

        ibm.utils.get(endpoint, {
            success: function (res) {
                var data = JSON.parse(res);
                if (!data || data.stat !== 'ok') {
                    return alert('An error occurred.');
                }

                var photos = data.photos.photo.map(function (p) {
                    return {
                        id: p.id,
                        standard: 'https://farm' + p.farm + '.staticflickr.com/' + p.server + '/' + p.id + '_' + p.secret + '.jpg',
                        hiRes: 'https://farm' + p.farm + '.staticflickr.com/' + p.server + '/' + p.id + '_' + p.secret + '_b.jpg',
                        title: p.title,
                        dateTaken: p.datetaken,
                        views: p.views
                    };
                });

                ibm.attachPhotosToDom(photos);
            },
            error: function (msg) {
                alert(msg);
            }
        });
    },

    // for each photo object in the collection add image properties as data-* attributes to the wrapper
    // so we can sort/filter later
    attachPhotosToDom: function (photoCollection) {
        var totalPhotos = photoCollection.length;
        var photosLoaded = 0;

        var photoListEl = $('#photo-list');
        photoCollection.forEach(function (p, index) {
            var wrapper = ibm.createPhotoWrapper(p, index);
            var title = ibm.createPhotoTitle(p.title);

            var img = new Image();
            img.src = p.standard;
            img.classList.add('photo-item');
            img.onload = function () {
                img.classList.add('loaded');

                if (img.width > img.height) {
                    wrapper.classList.add('wider');
                }
                else {
                    wrapper.classList.add('taller');
                }

                if (++photosLoaded === totalPhotos) {

                }
            };

            wrapper.appendChild(img);
            wrapper.appendChild(title);
            photoListEl.appendChild(wrapper);
        });

        ibm.checkStreamContainerWidth();
        ibm.photoListeners();
    },

    /**
     * Create photo wrapper from flickr api data
     * @param photo
     * @returns {HTMLElement}
     */
    createPhotoWrapper: function (photo, index) {
        var wrapper = document.createElement('div');
        wrapper.classList.add('photo-wrapper');
        wrapper.dataset.url = photo.standard;
        wrapper.dataset.title = photo.title;
        wrapper.dataset.views = photo.views;
        wrapper.dataset.id = photo.id;
        wrapper.dataset.index = index;

        if (photo.hasOwnProperty('dateTaken') && typeof photo.dateTaken === 'string') {
            wrapper.dataset.dateTaken = photo.dateTaken.split(' ')[0];
        }
        else {
            console.log('why u has no date taken?');
        }

        return wrapper;

    },

    /**
     * Create photo title element
     * @param title
     * @returns {HTMLElement}
     */
    createPhotoTitle: function (title) {
        var el = document.createElement('span');
        el.classList.add('photo-info');
        el.innerText = title;

        return el;
    },

    photoListeners: function () {
        $$('.photo-wrapper').forEach(function (wrapper) {
            var img = wrapper.querySelector('img.photo-item');

            img.on('click', function () {
                ibm.makePhotoActive(wrapper);
            }, false);
        });
    },

    makePhotoActive: function (wrapper) {
        var activeContainer = $('#active-container');

        ibm.utils.removeClassAll('active-wrapper');
        wrapper.classList.add('active-wrapper');

        var hiRes = new Image();
        hiRes.classList.add('hi-res');
        hiRes.src = wrapper.dataset.url;
        hiRes.onload = function () {
            activePhoto.innerHTML = '';
            activePhoto.appendChild(hiRes);
            hiRes.classList.add('loaded');
        };

        var activePhoto = activeContainer.querySelector('#active-photo');

        activeContainer.querySelector('#title').textContent = wrapper.dataset.title;
        activeContainer.querySelector('#date-taken').textContent = wrapper.dataset.dateTaken;
        activeContainer.querySelector('#views').textContent = wrapper.dataset.views;
        activeContainer.style.display = 'block';

        activeContainer.querySelector('.active-controls').dataset.index = wrapper.dataset.index;
    },

    streamControls: function () {
        $('#stream-search').on('click', function () {
            var searchBar = $('#search-term');
            var term = searchBar.value;
            console.log(term);
        }, false);

        $('#stream-filters').on('change', function () {
            console.log(this.value);
        }, false);

        $('#stream-sorts').on('change', function () {
            console.log(this.value);
        }, false);
    },

    // check stream container width, if it's smaller than 400px we need to resize the photos
    // so we can fit two side by side.
    checkStreamContainerWidth: function () {
        var list = $('#photo-list');

        var rectData = list.getBoundingClientRect();
        if (rectData.width < 400) {
            var newEdgeLength = (rectData.width * 0.5) + 'px';
            $$('.photo-wrapper').forEach(function (wrap) {
                wrap.style.width = newEdgeLength;
                wrap.style.height = newEdgeLength;
            });
        }
    }
};

ibm.utils = {
    promise: function (endpoint, options) {
        if (options === void 0) {
            options = { success: noop, error: noop, data: {}, method: 'GET' };
        }

        var method = options.method || 'GET';

        return new Promise(function (resolve, reject) {
            var req = new XMLHttpRequest();
            req.open(method, endpoint);

            req.onload = function () {
                if (req.status == 200) {
                    resolve(req.response);
                }
                else {
                    reject(Error(req.statusText));
                }
            };
            req.onerror = function () {
                reject(Error("Something went wrong ... "));
            };

            var data = ibm.utils.toQueryString(options.data) || '';
            req.send(data);
        });
    },

    // IE doesn't support promises because of course not
    get: function (endpoint, options) {
        if (options === void 0) {
            options = { success: noop, error: noop, data: {} };
        }

        var req = new XMLHttpRequest();
        req.open('GET', endpoint);

        req.onload = function () {
            if (req.status == 200) {
                options.success(req.response);
            }
            else {
                options.error(req.statusText);
            }
        };
        req.onerror = function () {
            options.error("Something went wrong");
        };

        var data = ibm.utils.toQueryString(options.data);
        req.send(data);
    },

    toQueryString: function (obj) {
        if (typeof obj !== 'object' || Object.keys(obj).length === 0) {
            return '';
        }

        var qs = '';
        for (var key in obj) {
            var val = obj[key];

            if (!qs.length) {
                qs += encodeURIComponent(key) + '=' +  encodeURIComponent(val); //key + '=' + val;
            }
            else {
                qs += '&' + encodeURIComponent(key) + '=' +  encodeURIComponent(val);
            }
        }

        return qs;
    },

    removeClassAll: function (className) {
        $$('.' + className).forEach(function (el) {
            el.classList.remove(className);
        });
    }
};

ibm.init();
