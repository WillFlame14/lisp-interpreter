(let [add4 (fn [] (let [x 4]
                    (fn [y] (__plus x y))))]
  (__print ((add4) 3)))