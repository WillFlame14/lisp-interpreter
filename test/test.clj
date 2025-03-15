(let [eempty? (fn ee [list] true)
      maphead (fn mh [list]
                (if (eempty? list) 3 4))]
  (maphead 2))