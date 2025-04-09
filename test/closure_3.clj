(let [add4 (fn [] (let [x 4]
                    (fn [y] (+ x y))))]
  (print ((add4) 3)))