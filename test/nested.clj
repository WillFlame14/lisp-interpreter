(let [eempty? (fn ee [list] true)
      maphead (fn mh [] (eempty? (quote (1))))]
  (maphead))